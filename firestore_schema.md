# 달료 Firestore 컬렉션 설계

> Firebase / Firestore (NoSQL)
> SQL 스키마 대신 컬렉션(Collection) + 도큐먼트(Document) 구조

---

## 설계 핵심 원칙

1. JOIN 없음 → 자주 같이 읽히는 데이터는 같은 도큐먼트에 묶음
2. 피드는 Fan-out → 포스트 작성 시 팔로워 피드에 미리 복사
3. 카운트는 도큐먼트에 직접 저장 → 매번 COUNT 쿼리 대신 캐싱
4. 복합 쿼리는 인덱스로 해결

---

## 컬렉션 구조 전체 맵

```
users/{uid}
  └─ character/            (서브컬렉션)
  └─ notifications/        (서브컬렉션)
  └─ feed/                 (서브컬렉션) ← Fan-out 피드

posts/{postId}
  └─ comments/             (서브컬렉션)
  └─ likes/                (서브컬렉션)

follows/{followerId_followingId}   (플랫 컬렉션)
bookmarks/{uid_postId}             (플랫 컬렉션)
together_rooms/{roomId}
  └─ members/              (서브컬렉션)
parks/{parkId}
  └─ courses/              (서브컬렉션)
```

---

## users/{uid}

```js
{
  uid:              string,        // Firebase Auth UID와 동일
  email:            string,
  display_name:     string,        // 닉네임
  profile_image:    string | null, // Firebase Storage URL
  website:          string | null, // 인플루언서 외부 링크
  phone:            string | null, // 휴대폰 번호 (폰 인증 로그인)
  height_cm:        number | null, // 키 (온보딩 입력)
  weight_kg:        number | null, // 몸무게 (온보딩 입력)
  gender:           'female' | 'male' | 'other' | null,
  total_km:         number,        // 누적 달린 거리 (캐릭터 성장 기준)
  total_exp:        number,        // 누적 경험치
  last_run_at:      Timestamp | null, // 마지막 달리기 (돌 변신 판단)
  is_frozen:        boolean,       // 돌 변신 여부 (7일 미달리기 시 true)
  influencer_tier:  'none' | 'nano' | 'micro' | 'macro' | 'mega',
  follower_count:   number,        // 팔로워 수 (Cloud Function으로 자동 갱신)
  following_count:  number,        // 팔로잉 수 (Cloud Function으로 자동 갱신)
  dialect:          'std' | 'gyeong' | 'jeon' | 'chung' | 'jeju',
  fcm_token:        string | null, // 푸시 알림 토큰 (Firebase 네이티브)
  created_at:       Timestamp
}
```

---

## users/{uid}/character/{uid}

서브컬렉션이지만 도큐먼트 1개만 존재 (유저당 캐릭터 1개)

```js
{
  stage:          'egg' | 'sprout' | 'baby' | 'runner' | 'champion' | 'stone',
  character_type: string,    // 'penguin' | 'rabbit' | 'bear' | 'fox' (가입 시 랜덤)
  exp:            number,    // 현재 경험치
  stat_stamina:   number,    // 체력 스탯 (0~100)
  stat_speed:     number,    // 속도 스탯 (0~100)
  stat_endurance: number,    // 지구력 스탯 (0~100)
  last_active_at: Timestamp
}
```

---

## users/{uid}/feed/{postId}

★ Fan-out 피드 — 포스트 작성 시 Cloud Function이 팔로워 전원의 feed에 복사
직접 쓰지 않고 항상 Cloud Function이 관리

```js
{
  post_id:        string,    // 원본 posts/{postId} 참조용
  author_uid:     string,
  author_name:    string,    // 복사 (JOIN 없이 표시하려고)
  author_image:   string,
  author_tier:    string,
  text:           string,
  image_url:      string | null,
  distance_km:    number,
  avg_pace_sec:   number,
  calories:       number,
  weather_temp:   number | null,
  hashtags:       string[],
  like_count:     number,
  comment_count:  number,
  dialect:        string,
  created_at:     Timestamp
}
```

---

## users/{uid}/notifications/{notifId}

```js
{
  type:       'follow' | 'like' | 'comment' | 'level_up'
            | 'stone_warning' | 'tier_up' | 'together_invite',
  actor_uid:  string,        // 알림을 발생시킨 유저
  actor_name: string,        // 복사 (표시용)
  target_id:  string | null, // post_id 또는 room_id
  is_read:    boolean,
  created_at: Timestamp
}
```

---

## runs/{runId}

```js
{
  run_id:         string,
  uid:            string,    // 어떤 유저의 기록인지
  goal_type:      'free' | 'time' | 'distance' | 'calorie',
  goal_value:     number | null,
  started_at:     Timestamp,
  ended_at:       Timestamp,
  duration_sec:   number,    // 총 달린 시간 (초)
  distance_km:    number,    // 총 달린 거리 (km)
  avg_pace_sec:   number,    // 평균 페이스 (초/km)
  avg_speed_kmh:  number,
  avg_heart_rate: number | null,
  calories:       number,
  route:          GeoPoint[], // GPS 좌표 배열 [{lat, lng}, ...]
  park_id:        string | null, // 공원 달리기인 경우
  exp_earned:     number,
  created_at:     Timestamp
}
```

---

## posts/{postId}

```js
{
  post_id:        string,
  uid:            string,
  // 작성자 정보 복사 (JOIN 없이 피드 카드 표시)
  author_name:    string,
  author_image:   string,
  author_tier:    string,
  run_id:         string | null, // 연결된 달리기 기록
  category:       'feed' | 'local' | 'qna' | 'free',
  text:           string,
  image_url:      string | null, // Firebase Storage URL
  // 달리기 데이터 복사 (run 삭제돼도 피드 유지)
  distance_km:    number | null,
  avg_pace_sec:   number | null,
  calories:       number | null,
  weather_temp:   number | null,
  route_thumb_url: string | null,
  hashtags:       string[],
  like_count:     number,        // 캐싱 (Cloud Function으로 자동 갱신)
  comment_count:  number,        // 캐싱
  visibility:     'public' | 'followers',
  dialect:        string,
  created_at:     Timestamp
}
```

---

## posts/{postId}/comments/{commentId}

```js
{
  comment_id:   string,
  uid:          string,
  author_name:  string,   // 복사 (표시용)
  author_image: string,
  parent_id:    string | null, // 대댓글인 경우 부모 comment_id
  text:         string,
  created_at:   Timestamp
}
```

---

## posts/{postId}/likes/{uid}

도큐먼트 ID = uid (한 유저가 같은 포스트에 좋아요 두 번 불가)

```js
{
  uid:        string,
  created_at: Timestamp
}
```

---

## follows/{followerId_followingId}

도큐먼트 ID = `${followerId}_${followingId}` (중복 팔로우 방지)

```js
{
  follower_id:  string, // 팔로우를 하는 쪽
  following_id: string, // 팔로우를 받는 쪽
  created_at:   Timestamp
}
```

---

## bookmarks/{uid_postId}

도큐먼트 ID = `${uid}_${postId}`

```js
{
  uid:        string,
  post_id:    string,
  created_at: Timestamp
}
```

---

## together_rooms/{roomId}

```js
{
  room_id:    string,
  host_uid:   string,
  host_name:  string,   // 복사 (표시용)
  goal_type:  string,
  goal_value: number | null,
  status:     'waiting' | 'running' | 'finished',
  started_at: Timestamp | null,
  created_at: Timestamp
}
```

---

## together_rooms/{roomId}/members/{uid}

```js
{
  uid:               string,
  display_name:      string,
  profile_image:     string,
  current_km:        number,       // 실시간 갱신 (onSnapshot)
  current_pace_sec:  number | null,
  rank:              number,
  joined_at:         Timestamp
}
```

---

## parks/{parkId}

```js
{
  park_id: string,
  name:    string,  // 예: 여의도 한강공원
  lat:     number,
  lng:     number,
  address: string
}
```

---

## parks/{parkId}/courses/{courseId}

```js
{
  course_id:   string,
  distance_km: number, // 3.0 | 5.0 | 10.0
  route:       GeoPoint[]
}
```

---

## Cloud Functions 목록 (자동화 처리)

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `onPostCreate` | posts 도큐먼트 생성 | 작성자 팔로워 전원의 feed에 Fan-out 복사 |
| `onPostDelete` | posts 도큐먼트 삭제 | 팔로워 feed에서 해당 포스트 삭제 |
| `onLikeCreate` | likes 도큐먼트 생성 | posts.like_count +1, 작성자에게 알림 |
| `onLikeDelete` | likes 도큐먼트 삭제 | posts.like_count -1 |
| `onCommentCreate` | comments 도큐먼트 생성 | posts.comment_count +1, 작성자에게 알림 |
| `onFollowCreate` | follows 도큐먼트 생성 | follower_count/following_count +1, Fan-out 시작, 알림 |
| `onFollowDelete` | follows 도큐먼트 삭제 | follower_count/following_count -1, 피드 정리 |
| `stoneScheduler` | 매일 자정 (Cron) | last_run_at 기준 돌 변신 처리 + FCM 알림 |
| `tierCalculator` | 매일 자정 (Cron) | follower_count 기준 influencer_tier 업데이트 |

---

## Firestore 인덱스 (복합 인덱스 필요 목록)

```
runs:         uid ASC, created_at DESC
posts:        uid ASC, created_at DESC
posts:        category ASC, created_at DESC
follows:      follower_id ASC, created_at DESC
follows:      following_id ASC, created_at DESC
together_rooms: status ASC, created_at DESC
notifications: uid ASC, created_at DESC  (서브컬렉션)
```

---

## SQL → Firestore 핵심 변경 요약

| 항목 | Supabase (SQL) | Firebase (Firestore) |
|------|---------------|---------------------|
| 피드 조회 | follows JOIN posts | users/{uid}/feed 서브컬렉션 |
| 좋아요 수 | COUNT 쿼리 | posts.like_count 필드 캐싱 |
| 팔로워 피드 | JOIN 실시간 | Fan-out (Cloud Function) |
| 스케줄러 | Edge Function | Cloud Functions + Pub/Sub |
| 실시간 | Supabase Realtime | Firestore onSnapshot (더 강력) |
| 폰 인증 | 외부 SMS 공급자 필요 | Firebase Auth 기본 내장 ✅ |

