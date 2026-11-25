# 달료 Firestore 컬렉션 설계

> 2026-11-23 실제 코드 기준. 개발 DB `dalryo-dev` / `(default)` / Standard, 서버 함수 리전 `asia-northeast3`
> 규칙 [firestore.rules](firestore.rules) · 인덱스 [firestore.indexes.json](firestore.indexes.json) · 서버 함수 [functions/src](functions/src)

---

## 설계 원칙

1. **쓰기는 서버가 한다.** 앱이 직접 쓰는 것은 가입(users·character·handles 생성), 프로필 일부 수정, runs 생성, 알림 읽음 표시, 같이 달리기 진행 상황뿐이다. 게시물·댓글·응원·팔로우·채팅·방·보관함·성장은 서버 함수가 트랜잭션으로 처리한다.
2. **users는 비공개다.** 키·몸무게·전화번호·FCM 토큰이 들어 있어 본인만 읽는다. 다른 사람 정보는 서버가 공개 필드만 골라서 준다(`publicUser`: uid, display_name, user_id, profile_image, total_km, region, follower_count, following_count, influencer_tier).
3. **피드는 복사하지 않는다.** 팔로워마다 피드를 복사하는 Fan-out은 쓰지 않는다. 요청할 때마다 `socialAction`이 posts에서 골라 만든다.
4. **카운트는 문서에 저장한다.** like_count, comment_count, follower_count 등은 서버가 같은 트랜잭션에서 함께 고친다.
5. **재시도해도 한 건만 남도록 ID를 미리 정한다.** runs는 `{uid}_{시작 시각 ms}`, 게시물·댓글·메시지·방은 앱이 만든 ID, 1:1 대화방은 UID 쌍의 SHA-256, 알림은 `follow_{uid}`처럼 행동별 ID를 쓴다.

---

## 컬렉션 맵

```
users/{uid}                               비공개 사용자 정보
  ├─ character/{uid}                      캐릭터 (문서 1개)
  ├─ notifications/{notifId}              알림
  ├─ inventory/{itemId}                   보유 꾸미기 아이템
  ├─ blocks/{targetUid}                   내가 차단한 사람
  ├─ blocked_by/{uid}                     나를 차단한 사람 (서버 전용)
  ├─ hidden_posts/{postId}                "이 게시물 보지 않음"
  ├─ room/active                          참가 중인 같이 달리기 방
  ├─ room_invites/{roomId}                받은 같이 달리기 요청
  └─ park_search/rate                     공원 검색 간격 제한 (서버 전용)
handles/{userId}                          아이디 중복 방지
runs/{runId}                              달리기 기록
posts/{postId}                            게시물
  ├─ comments/{commentId}
  ├─ likes/{uid}
  └─ shares/{uid}                         공유한 사람 (서버 전용)
follows/{followerId_followingId}
bookmarks/{uid_postId}
conversations/{id}                        1:1 대화
  └─ messages/{messageId}
group_conversations/{groupId}             그룹 대화
  └─ messages/{messageId}
together_rooms/{roomId}                   같이 달리기 방
  └─ members/{uid}
parks/{parkId}                            공원
  ├─ courses/{courseId}
  └─ weeks/{KST 월요일}/runners/{uid}      공원 주간 랭킹 (서버 전용)
park_search_cache/{lat_lng}               공원 검색 캐시 (서버 전용)
reports/{신고자_종류_대상ID}                신고 (서버 전용, 앱은 읽을 수 없다)
```

---

## users/{uid}

```js
{
  uid:                  string,
  email:                string | null,
  phone:                string | null,
  display_name:         string,         // 1~20자
  user_id?:             string,         // 아이디. 영문 소문자·숫자·_ 4~20자, 겹치지 않음 (handles 참고). 기능 도입 전 가입자는 없음
  pet_name:             string,         // 캐릭터 이름 1~20자. character.pet_name과 함께 바뀐다
  profile_image:        string | null,  // Storage profiles/{uid}/... 주소
  website:              string | null,  // 500자 이하, http(s)
  height_cm:            number | null,  // 50~250
  weight_kg:            number | null,  // 10~400. 칼로리 계산에 쓰고, 없으면 60kg
  gender:               'female' | 'male' | null,
  region:               string,         // "서울 강남구"·"경기 수원시"처럼 시·도 줄임 이름 + 구·군(광역시)/시·군(도). 세종은 "세종". 예전 값은 시·도만("경기"). 규칙·서버가 같은 정규식으로 검사
  total_km:             number,         // 누적 거리 (성장 기준)
  total_exp:            number,
  last_run_at:          Timestamp | null,
  is_frozen:            boolean,        // 돌 변신
  influencer_tier:      'none' | 'nano' | 'micro' | 'macro' | 'mega',
  follower_count:       number,
  following_count:      number,
  dialect:              'std' | 'gyeong' | 'jeon' | 'chung' | 'jeju' | 'seoul' | 'gyeonggi' | 'gangwon',
  fcm_token:            string | null,  // 푸시를 켠 기기의 토큰
  notification_settings?: { push: boolean, growth: boolean, social: boolean, stone: boolean },
  privacy?:             { runs_public?: boolean, connections_public?: boolean },  // 값이 없으면 공개
  created_at:           Timestamp,
  updated_at:           Timestamp
}
```

- **읽기:** 본인만.
- **만들기:** 가입 때 본인이 만든다. 성장값·카운터는 0, 등급은 `none`이어야 한다(규칙).
- **고치기:**
  - 본인이 직접 바꿀 수 있는 키는 display_name, profile_image, website, height_cm, weight_kg, gender, region, dialect, fcm_token, updated_at뿐이다.
  - 설정 화면의 저장은 `saveAccountSettings`가 아이디·캐릭터 이름·알림 설정과 함께 한 번에 한다.
  - 성장값(total_km, total_exp, last_run_at)은 `onRunCreate`, 카운터·등급은 `socialAction`, is_frozen은 `stoneScheduler`(얼림)와 `onRunCreate`(해동), privacy는 `socialAction.setPrivacy`가 바꾼다.
- **dialect:** 가입 때 고른 지역의 말투 코드가 저장된다. 서울·인천은 `seoul`, 경기는 `gyeonggi`, 강원은 `gangwon`이며 앱은 이 셋을 표준어로 보여 준다. 설정에서 바꾸면 다섯 값(std·gyeong·jeon·chung·jeju) 중 하나가 된다.
- **influencer_tier:** 따로 도는 스케줄러는 없다. 팔로우·차단으로 follower_count가 바뀔 때 `socialAction`이 바로 다시 계산한다(nano 1천, micro 1만, macro 10만, mega 100만).
- **notification_settings.growth:** 저장만 되고 아직 쓰는 곳이 없다. 성장 알림은 앱 안 알림만 있고 푸시는 없다.

---

## users/{uid}/character/{uid}

유저당 문서 1개.

```js
{
  uid:            string,
  stage:          'egg' | 'baby' | 'child' | 'runner',
  character_type: string,   // 37종 중 하나. 가입 선물은 rabbit·duck만
  pet_name:       string,
  exp:            number,
  stat_stamina:   number,   // 0~100
  stat_speed:     number,   // 0~100
  stat_endurance: number,   // 0~100
  equipped?:      { back?, bottom?, top?, shoes?, hat?, accessory?: string },  // 장착한 아이템 id
  last_active_at: Timestamp,
  created_at:     Timestamp,
  updated_at:     Timestamp
}
```

- **읽기:** 본인만. 다른 사람의 캐릭터는 `socialAction.profile`이 필요한 값만 내려 준다.
- **만들기:** 가입 때 본인이 만든다. 규칙이 stage `egg`, 타입 rabbit·duck, 경험치·스탯 0을 강제한다.
- **고치기:** 성장은 `onRunCreate`, 이름은 `saveAccountSettings`, equipped는 `inventoryAction`만 한다.
- **단계:** 첫 달리기(거리 > 0)에 baby, 누적 50km에 child, 200km에 runner. 되돌아가지 않는다. 예전 5단계(sprout·champion) 값이 남은 캐릭터는 앱이 누적 거리로 다시 계산해 보여 준다.
- **그림:** egg는 앱의 egg.png, 나머지는 Storage `characters/{type}/{type}_S|M|L.png`.

---

## users/{uid}/notifications/{notifId}

```js
{
  type:         'follow' | 'like' | 'comment' | 'room_invite' | 'level_up' | 'stone_warning',
  actor_uid:    string,
  actor_name:   string,
  actor_image?: string | null,   // 상대 프로필 사진. 이 필드 도입 전 알림에는 없다
  target_id:    string | null,   // like·comment: postId / follow: 팔로워 uid / room_invite: roomId
  stage?:       string,          // level_up: 새 단계
  level?:       'warn3' | 'warn5' | 'stone',  // stone_warning
  is_read:      boolean,
  created_at:   Timestamp
}
```

- **문서 ID:** `follow_{actorUid}`, `like_{postId}_{actorUid}`, `comment_{commentId}`, `room_invite_{roomId}`라서 같은 행동은 덮어쓴다. level_up·stone_warning은 자동 ID다.
- **읽기·고치기:** 본인만 읽고, is_read만 바꿀 수 있다. 만들기는 서버만 한다.
- 앱은 `settings` 종류를 이동 대상으로 준비해 뒀지만 서버가 아직 만들지 않는다. 등급 상승(`tier_up`) 알림은 없다.

---

## users/{uid}/inventory/{itemId}

```js
{ item_id: string, source: 'starter' | 'distance', acquired_at: Timestamp }
```

- 아이템 정의는 DB가 아니라 코드 [functions/src/itemCatalog.ts](functions/src/itemCatalog.ts)에 있고 앱도 같은 파일을 쓴다.
  - `mint-glow`(back)·`gold-stars`(accessory): 기본 지급
  - `peach-glow`(back): 누적 5km
  - `pink-petals`(accessory): 누적 10km
- `inventoryAction`이 조회할 때마다 자격이 되는 아이템을 한 번씩 지급한다. 본인만 읽고, 쓰기는 서버만 한다.
- 규칙에 `items/{id}`, `room_catalog/{id}` 읽기 규칙이 있지만 데이터는 없다.

---

## 차단·숨김 (서버만 쓴다)

```js
// users/{나}/blocks/{상대}: 내가 차단한 사람. 나만 읽는다(설정의 차단 목록, 댓글 거르기)
{ uid, display_name, user_id, profile_image, created_at }
// users/{상대}/blocked_by/{나}: 상대의 목록에서 내 글을 빼기 위한 사본. 앱은 읽을 수 없다
{ uid, created_at }
// users/{나}/hidden_posts/{postId}: "이 게시물 보지 않음". 나만 읽는다
{ post_id, created_at }
```

차단하면 서로의 팔로우가 끊기고 기존 1:1 대화방의 blocked_by에 들어간다. 이후 서로 팔로우·응원·댓글·새 대화를 할 수 없다.

---

## 같이 달리기 보조 문서 (서버만 쓴다, 본인만 읽는다)

```js
// users/{uid}/room/active: 지금 참가 중인 방. 한 사람은 한 방에만 들어갈 수 있다
{ room_id }
// users/{uid}/room_invites/{roomId}: 받은 요청. 수락·거절·방 시작·방 취소 때 지운다
{ room_id, host_uid, host_name, title, goal_km, created_at }
```

`users/{uid}/park_search/rate`(`{ at }`)는 공원 검색 간격(30초) 제한용이며 서버만 쓴다.

---

## handles/{userId}

문서 ID가 아이디(`users.user_id`)다. 먼저 차지한 사람의 것이라 같은 아이디가 겹치지 않는다.

```js
{ uid: string, created_at: Timestamp }
```

- 가입 때 앱이 users·character와 한 트랜잭션으로 만든다. 규칙이 users.user_id와 같은지 확인한다.
- 아이디를 바꾸면 `saveAccountSettings`가 새 문서를 만들고 이전 문서를 지운다.
- 로그인 사용자가 하나씩 읽을 수만 있다(목록 조회 불가).

---

## runs/{runId}

```js
{
  run_id:         string,     // `${uid}_${started_at ms}`
  uid:            string,
  goal_type:      'free' | 'time' | 'distance' | 'calorie',
  goal_value:     number | null,
  started_at:     Timestamp,
  ended_at:       Timestamp,  // 서버 시각
  duration_sec:   number,     // 1~86400
  distance_km:    number,     // 0~100
  avg_pace_sec:   number,
  avg_speed_kmh:  number,
  avg_heart_rate: null,       // 아직 수집하지 않음
  calories:       number,
  route:          { lat, lng, timestamp }[],  // 5m 이상 움직였을 때만 추가. 앱은 6,000점을 넘으면 절반으로 간추린다 (규칙 상한 12,000)
  park_id:        string | null,
  course_id?:     string,
  exp_earned:     number,     // 앱은 0으로 만들고 onRunCreate가 채운다
  growth_applied?: boolean,   // 서버만. 성장 반영 완료 표시
  flagged?:       boolean,    // 서버만. 평균 25km/h 초과면 true, 성장 미반영
  created_at:     Timestamp
}
```

- 본인이 만들고 본인만 읽는다. 수정·삭제는 할 수 없다.
- 기록 ID가 시작 시각으로 정해져 있어서 수동 재시도와 자동 동기화가 겹쳐도 한 건만 남는다.
- 앱은 기기 저장소(AsyncStorage outbox)에 먼저 보관한 뒤 올린다.
- park_id·course_id는 실제로 있는 parks 문서와 그 아래 코스만 허용한다(규칙).

---

## posts/{postId}

```js
{
  post_id:       string,
  uid:           string,
  author_name:   string,         // 작성 시점 사본. 화면은 publicProfiles로 최신 이름·사진을 다시 받아 쓴다
  author_image:  string | null,
  author_tier:   string,
  category:      'feed',
  text:          string,         // 2000자 이하
  image_url:     string | null,  // Storage posts/{uid}/... (오운완 카드 이미지 포함)
  visibility:    'public' | 'followers' | 'private',
  run_id:        string | null,
  distance_km:   number | null,  // 첨부한 run에서 서버가 복사
  avg_pace_sec:  number | null,
  calories:      number | null,
  hashtags:      string[],       // 본문의 #태그 최대 10개, 서버가 뽑는다
  with_runners:  { uid: string, display_name: string }[],  // 함께 달린 사람(서로 팔로우하는 친구, 최대 10명). 이름은 작성 시점 사본
  like_count:    number,
  comment_count: number,
  share_count:   number,         // 공유한 사람 수(한 사람은 한 번만)
  deleted:       boolean,
  dialect:       string,
  created_at:    Timestamp,
  updated_at:    Timestamp
}
```

- **쓰기:** `socialAction`의 createPost·editPost·deletePost·share.
- **예전 글:** 2026-11-24 이전 글에는 with_runners·share_count가 없다. 앱은 빈 목록·0으로 읽는다.
- **shares/{uid}:** `share` 요청 때 서버만 쓴다. 문서가 이미 있으면 share_count를 올리지 않는다. 규칙상 앱은 읽을 수 없다.
- **삭제:** 문서를 지우지 않는다. deleted를 true로 바꾸고 본문·사진을 비운 뒤 private로 돌린다.
- **읽기(규칙):** 작성자, public 글은 로그인 사용자, followers 글은 팔로워.
- 이전 설계의 weather_temp, route_thumb_url은 없다.

## posts/{postId}/comments/{commentId}

```js
{
  comment_id:    string,
  uid:           string,
  author_name:   string,
  author_image:  string | null,
  text:          string,         // 1~1000자
  parent_id:     string | null,  // 답글이면 부모 댓글 id
  reply_to_name: string | null,  // 답글 앞의 @이름. 이 필드 도입 전 답글에는 없다
  deleted:       false,
  created_at:    Timestamp
}
```

- 쓰기는 `socialAction`의 comment·deleteComment가 한다. 차단 관계면 댓글을 달 수 없다.
- 답글(답글의 답글 포함)은 원댓글 아래 한 스레드로 모아 보여 준다([src/utils/commentThreads.ts](src/utils/commentThreads.ts)).
- 삭제하면 문서째 지우고 그 아래 답글도 모두 지운 뒤 comment_count를 그만큼 줄인다. 이전 방식으로 `deleted: true`만 남은 문서는 앱이 보여 주지 않는다.

## posts/{postId}/likes/{uid}

```js
{ uid, post_id, created_at }
```

문서 ID가 uid라서 한 사람이 두 번 응원할 수 없다. `socialAction.like`가 like_count와 알림을 함께 처리한다.

---

## follows/{followerId_followingId}

```js
{ follower_id: string, following_id: string, created_at: Timestamp }
```

- `socialAction.follow`가 문서·양쪽 카운터·등급·알림을 한 트랜잭션에서 처리한다. 한 사람이 팔로우할 수 있는 수는 최대 300명이다.
- 서로 팔로우하면 친구이며, 친구에게만 같이 달리기를 요청할 수 있다.
- 로그인 사용자는 누구나 읽을 수 있다.

## bookmarks/{uid_postId}

```js
{ uid, post_id, created_at }
```

`socialAction.bookmark`가 쓴다. 앱은 본인 목록을 직접 읽고 각 글은 `socialAction.post`로 받는다(읽을 수 없게 된 글은 빠진다).

---

## conversations/{id} · group_conversations/{groupId}

```js
{
  members:         string[],   // 1:1은 정렬한 UID 2개
  profiles:        { [uid]: { display_name, profile_image } },  // 방 만들 때 사본. 화면은 최신 공개 프로필을 다시 받아 쓴다
  blocked_by:      string[],
  deleted_members?: string[],  // 탈퇴한 사람. profiles의 그 사람은 "탈퇴한 러너"로 바뀐다
  muted_by?:       string[],   // 이 방의 푸시를 끈 사람
  read_at:         { [uid]: Timestamp },
  last_text:       string,     // 120자까지
  last_sender_uid: string | null,
  last_message_id: string | null,
  last_sent_at:    Timestamp | null,
  created_at:      Timestamp,
  updated_at:      Timestamp,
  // group_conversations만
  kind:            'group',
  name:            string      // 0~40자
}
```

- **1:1 방:** ID는 SHA-256(정렬한 UID 쌍)이라 두 사람 사이에 방이 하나뿐이다.
- **그룹 방:**
  - ID는 `group_` + SHA-256(만든 사람, requestId)이다.
  - 만든 사람 외에 2~9명을 초대한다.
  - 나간 사람은 members에서 빠지지만 profiles에는 남아, 남은 사람이 예전 메시지의 보낸 사람을 볼 수 있다.
  - 그룹 방은 차단(chatBlock)할 수 없다.
- **탈퇴한 사람:** 메시지는 상대의 대화 기록이라 남긴다. `deleteAccount`가 profiles의 그 사람을 "탈퇴한 러너"(사진 없음)로 바꾸고 deleted_members에 넣는다. 1:1 방은 더 보낼 수 없고(chatSend가 막는다), 그룹 방은 members에서 뺀다.
- **쓰기:** 전부 `socialAction`의 chat* 작업이 한다.
- **읽기:** members에 든 사람만.

## …/messages/{messageId}

```js
{ sender_uid: string, text: string, created_at: Timestamp }  // text 1~2000자
```

- 수정·삭제는 없다. 같은 ID·같은 내용으로 다시 보내면 성공으로 처리한다(응답 유실 재시도).
- 직전 메시지 후 0.5초 안에 보내면 거절한다. 그룹 방은 같은 사람이 연달아 보낼 때만 거절한다.
- 읽음은 화면에 보인 최신 메시지가 서버의 최신 메시지와 같을 때만 반영한다.

---

## together_rooms/{roomId}

친구(서로 팔로우)에게 요청을 보내 만드는 비공개 방. 쓰기는 `roomAction`만 하고, 읽기는 participants에 든 사람만 할 수 있다.

```js
{
  room_id:       string,        // 앱이 미리 만든 ID
  title:         string,        // 1~40자
  host_uid:      string,
  host_name:     string,
  goal_km:       number,        // 0.1~100
  capacity:      number,        // 방장 + 요청한 친구 수 (최대 20)
  member_count:  number,
  invited:       string[],      // 아직 응답하지 않은 친구. 시작하면 비운다
  invited_names: { [uid]: string },
  participants:  string[],      // 방장 + 지금까지 요청받은 모든 친구 (읽기 권한)
  status:        'waiting' | 'running' | 'finished' | 'cancelled',
  started_at?:   Timestamp,
  finished_at?:  Timestamp,
  expires_at:    Timestamp,     // 대기 12시간, 시작 후 24시간
  created_at:    Timestamp,
  updated_at:    Timestamp
}
```

- 방장이 나가면 남은 사람에게 방장을 넘긴다.
- 모두 나가면 대기 중이던 방은 cancelled, 달리던 방은 finished가 된다. 모두 완주해도 finished가 된다.

## together_rooms/{roomId}/members/{uid}

```js
{
  uid:           string,
  display_name:  string,
  profile_image: string | null,
  current_km:    number,   // 0~100, 줄어들 수 없음
  pace_sec:      number,   // 평균 페이스(초/km)
  state:         'active' | 'paused' | 'finished' | 'left',
  joined_at:     Timestamp,
  updated_at:    Timestamp
}
```

- 참가·완주·나가기는 `roomAction`이 한다.
- 달리는 동안에는 본인이 5초마다 current_km·pace_sec·state를 직접 고친다(규칙: 방이 running이고 state가 active·paused일 때만).
- 순위는 앱이 current_km로 정렬해 정한다(저장하지 않음). 목표 거리에 닿으면 앱이 자동으로 완주 처리한다.

---

## parks/{parkId}

```js
{
  park_id: string,   // 'osm_{node|way|relation}_{OSM id}'
  name:    string,
  lat:     number,
  lng:     number,
  address: string,
  source:  'OpenStreetMap',
  osm_url: string
}
```

`parkAction.nearby`가 공개 OpenStreetMap 데이터(Overpass, Private.coffee)에서 받아 저장한다. 로그인 사용자는 읽기만 할 수 있다.

## parks/{parkId}/courses/{courseId}

```js
{ name?: string, distance_km: number, route: { lat, lng }[] }
```

관리자가 등록한 실제 코스만 쓴다. 앱·서버가 코스를 만들어 내지 않는다. 코스가 없으면 3/5/10km 거리 목표로 시작한다.

## parks/{parkId}/weeks/{YYYY-MM-DD}/runners/{uid}

```js
{ uid, display_name, profile_image, distance_km, run_count, updated_at }
```

- 문서 경로의 날짜는 한국 시간 기준 그 주의 월요일이다.
- 공원 달리기 기록이 저장되면 `onRunCreate`가 적립한다. 거리 0이거나 성장에서 제외된 기록은 빠진다.
- 앱은 직접 읽을 수 없고 `parkAction.rankings`로 상위 50명을 받는다.

## park_search_cache/{lat_lng}

```js
{ parks: ParkData[], updated_at: Timestamp }   // 최대 200개
```

- 서버 전용이다. 0.01도 격자 중심 기준으로 반경 11km를 받아 24시간 캐시한다.
- 공급자가 실패하면 7일 이내 캐시를 오래된 정보로 표시해 쓴다. 외부에는 격자 중심만 보내고 UID나 정확한 위치는 보내지 않는다.

---

## Storage

```
profiles/{uid}/{file}                  프로필 사진. 본인만 쓰기, 로그인 사용자 읽기
posts/{uid}/{file}                     게시물 사진·오운완 카드. 본인만 쓰기, 로그인 사용자 읽기
characters/{type}/{type}_S|M|L.png     캐릭터 그림 37종×3. 콘솔 업로드, 로그인 사용자 읽기
characters/{type}/{type}.riv           Rive 파일 자리. 아직 올라간 파일 없음 (없으면 PNG로 그림)
camera/{uid}/{file}                    규칙만 있고 쓰는 곳 없음
```

규칙은 10MB 미만 이미지만 받고, 앱은 8MB 미만으로 더 줄여서 올린다.

---

## 서버 함수 (functions/src, asia-northeast3)

| 함수 | 종류 | 하는 일 |
|---|---|---|
| `onRunCreate` | runs 생성 트리거 | 누적 거리·경험치·스탯·성장 단계 반영, last_run_at 갱신·돌 해제, 공원 주간 랭킹 적립, 단계가 오르면 level_up 알림. 평균 25km/h 초과는 flagged로 성장 제외. growth_applied로 한 번만 반영 |
| `stoneScheduler` | 매일 00:00 KST | 마지막 달리기 후 정확히 3일째 warn3, 5일째 warn5 알림. 7일 이상이면 is_frozen=true와 stone 알림. 말투별 푸시 |
| `saveAccountSettings` | callable | 설정 저장: 프로필·아이디(handles 교체)·캐릭터 이름·알림 설정·프로필 사진(본인 Storage 경로만) |
| `deleteAccount` | callable | 회원 탈퇴. 아래 "회원 탈퇴" |
| `socialAction` | callable | 아래 표 |
| `roomAction` | callable | friends, invites, create, invite, join, decline, start, leave, finish |
| `parkAction` | callable | nearby, courses, rankings |
| `inventoryAction` | callable (`invoker: 'public'`) | list, equip, unequip. 조회할 때 자격이 되는 아이템 지급 |

### socialAction 작업

| 분류 | action |
|---|---|
| 조회 | publicProfiles(최대 30명), search(닉네임 또는 `@아이디` 앞부분, 팔로잉 > 팔로워 > 그 외 순), rankings(누적 거리 상위 50), profile, profileRuns, connections, homeFeed, exploreFeed, followingFeed, profilePosts, post |
| 관계 | follow, setPrivacy, blockUser, hidePost, report |
| 게시물 | createPost, editPost, deletePost, like, bookmark, comment, deleteComment |
| 채팅 ([chat.ts](functions/src/chat.ts)) | chatOpen, chatCreateGroup, chatSend, chatRead, chatBlock, chatLeave, chatMute, chatRename |

### 신고 (report)

```js
// reports/{신고자uid}_{target_type}_{target_id}. 같은 사람이 같은 대상을 다시 신고하면 새로 만들지 않는다(duplicate: true)
{
  reporter_uid, target_type: 'post' | 'comment' | 'user' | 'chat', target_id,
  post_id,        // 댓글이면 그 게시물, 아니면 null
  target_uid,     // 신고당한 사람
  reason: 'spam' | 'abuse' | 'hate' | 'sexual' | 'danger' | 'fraud' | 'privacy' | 'other',
  detail,         // 0~500자
  snapshot,       // 신고 시점의 내용: 글(text·image_url), 댓글(text), 러너(display_name), 대화(최근 메시지 20개)
  status: 'open', created_at
}
```

- 내 글·내 계정은 신고할 수 없고, 대화는 그 방에 있는 사람만 신고할 수 있다.
- 앱은 게시물을 신고하면 `hidePost`도 함께 해 그 글을 내 피드에서 뺀다.
- 처리(검토·제재) 화면은 아직 없다. Firebase 콘솔에서 `reports`를 본다.

### 회원 탈퇴 (deleteAccount)

[accountDeletion.ts](functions/src/accountDeletion.ts). 중간에 실패해도 다시 부르면 남은 것을 이어서 지운다.

1. 내 게시물(달린 댓글·응원·공유 포함)과 그 글을 저장한 bookmarks
2. 다른 글에 남긴 댓글(답글 포함)·응원·공유 — 글의 카운트도 줄인다
3. 내 bookmarks, follows 양쪽(상대의 팔로워·팔로잉 수와 등급도 고친다), 차단 사본
4. 다른 사람에게 간 내 알림(actor_uid), 공원 주간 랭킹 기록, runs
5. 대화방: 메시지는 남기고 "탈퇴한 러너"로 바꾼다(위 conversations 참고)
6. 같이 달리기 방에서 나가기(방장이면 넘기고, 아무도 없으면 닫는다)
7. handles, `users/{uid}` 아래 전부, Storage의 profiles/·posts/·camera/{uid}/
8. Firebase Auth 계정

### 피드 구성 (Fan-out 대신)

- **homeFeed:** 내가 팔로우한 사람(최대 300명)과 내 글을 최신순으로 최대 60개 모은다. 4개마다 추천 글을 하나 끼운다.
- **exploreFeed:** 최근 공개 글 200개 중 내 글과 팔로우한 사람의 글을 뺀 뒤, 앱이 보낸 seed로 섞는다. 추천 기준은 아직 없다([explore.ts](functions/src/explore.ts)의 `recommendations`).
- **공통:**
  - 10개씩 offset으로 나눠 준다(offset 최대 90).
  - 내가 차단한 사람과 나를 차단한 사람의 글, "보지 않음"으로 고른 글은 뺀다.
  - 새로고침할 때마다 앱이 새 seed를 보내고, 같은 새로고침 안의 "더 보기"는 같은 seed를 쓴다.

### 푸시 알림

| 종류 | 보내는 곳 | 조건 |
|---|---|---|
| 팔로우·응원·댓글 | socialAction | push 켜짐, social 꺼지지 않음 |
| 같이 달리기 요청 | roomAction | push 켜짐, social 꺼지지 않음 |
| 채팅 | socialAction.chatSend | push 켜짐, 그 방을 음소거하지 않음. data `{type: 'chat', target_id: 방 ID}`로 앱이 대화방을 연다 |
| 돌 경고·돌 변신 | stoneScheduler | push 켜짐, stone 꺼지지 않음 |

성장(level_up)은 앱 안 알림만 만들고 푸시는 보내지 않는다.

---

## 앱이 직접 읽고 쓰는 범위

| 경로 | 읽기 | 쓰기 |
|---|---|---|
| users/{나}, character/{나} | 실시간 구독 | 가입 때 생성, 프로필 일부·fcm_token 수정 |
| handles/{아이디} | 하나씩 (가입 중복 확인) | 가입 때 생성 |
| runs | 본인 기록 (기간별·최근) | 생성 |
| notifications | 최신 20개씩, 안 읽음 1개 | is_read |
| posts, likes, comments | 게시물 하나, 응원 여부, 댓글 50개씩 실시간 | 없음 |
| bookmarks | 본인 것 | 없음 |
| conversations, group_conversations, messages | 참여 중인 방 50개씩, 메시지 50개씩 | 없음 |
| together_rooms, members | participants일 때 | 본인 member의 진행 상황 |
| parks, courses | 공원·코스 이름 표시 | 없음 |
| blocks, hidden_posts, room/active, room_invites, inventory | 본인 것 | 없음 |

---

## 인덱스 (firestore.indexes.json)

```
conversations:        members CONTAINS, updated_at DESC
group_conversations:  members CONTAINS, updated_at DESC
posts:                visibility ASC, created_at DESC
posts:                uid ASC, visibility ASC, created_at DESC
posts:                uid ASC, created_at DESC
posts:                category ASC, created_at DESC
bookmarks:            uid ASC, created_at DESC
runs:                 uid ASC, started_at DESC
follows:              follower_id ASC, created_at DESC
follows:              following_id ASC, created_at DESC
```

컬렉션 그룹 단일 필드 색인(회원 탈퇴가 내 흔적을 찾는 데 쓴다): comments.uid, likes.uid, shares.uid, notifications.actor_uid, runners.uid

`dalryo-dev` 서버에는 이전 공개 방 목록용 인덱스 1개가 더 남아 있다(삭제하려면 `--force` 배포 필요).

---

## 이전 설계에서 바뀐 점

| 이전 설계 | 지금 |
|---|---|
| `onPostCreate`·`onPostDelete`가 팔로워 `users/{uid}/feed`에 글을 복사 (Fan-out) | 없음. `socialAction.homeFeed`가 요청 때 만든다. feed 서브컬렉션과 그 규칙도 지웠다(2026-11-25) |
| `onLikeCreate`·`onLikeDelete`·`onCommentCreate`·`onFollowCreate`·`onFollowDelete` 트리거 | 없음. `socialAction`이 문서·카운트·알림을 한 트랜잭션에서 처리 |
| `tierCalculator`가 매일 등급 계산 | 없음. 팔로우·차단 때 바로 다시 계산. tier_up 알림 없음 |
| 앱이 posts·likes·comments·follows·bookmarks·together_rooms를 직접 씀 | 앱은 쓸 수 없고 서버 함수만 쓴다 |
| `items/{itemId}` 아이템 카탈로그 컬렉션 | 코드(itemCatalog.ts)에 정의 |
| 가입 때 goldpig를 뺀 36종 중 무작위 | rabbit·duck 중 무작위 |
| members.current_pace_sec, rank | pace_sec, state. 순위는 저장하지 않음 |
| posts.weather_temp, route_thumb_url | 없음 |
| gender 'other' | 없음 (female·male·null) |
| 공원 랭킹을 runs에서 조회 | onRunCreate가 parks/{id}/weeks에 적립 |
