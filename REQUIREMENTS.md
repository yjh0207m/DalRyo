# REQUIREMENTS.md — 달료 런닝 앱

> Claude Code 작업용 요구사항 명세서 v0.6
> `"F-RUN-02 구현해줘. REQUIREMENTS.md 참고해."` 형식으로 지시
>
> 각 기능의 **요구**는 기획 당시 그대로 두고, **현재 구현**은 2026-11-23 실제 코드 기준으로 적는다.
> 데이터 구조는 [firestore_schema.md](firestore_schema.md)가 기준이다. 진행 기록은 [docs/development-status.md](docs/development-status.md).

---

## 프로젝트 개요

실제 의존성은 [package.json](package.json)이 기준이다.

| 항목 | 현재 사용 |
|------|------|
| 앱 이름 | 달료 (Dalryo). 패키지·번들 ID `com.dalryo.app`, 앱 이름·모듈명은 아직 `DalRyoTemp` |
| 플랫폼 | React Native CLI 0.85 (New Architecture), iOS / Android |
| 언어 | TypeScript, React 19 |
| 상태관리 | 별도 라이브러리 없음. 화면 상태와 모듈 상태(`useSyncExternalStore`) |
| 내비게이션 | 라이브러리 없음. `MainAppScreen`의 상태 분기 + `src/navigation`의 탭 페이저(`tabPager`)·밀려 들어오는 화면(`slide`)·iOS 가장자리 뒤로가기(`backGesture`) |
| DB | Firestore (`dalryo-dev`, Standard) |
| 인증 | Firebase Auth 전화번호 인증 (`@react-native-firebase/auth`) |
| 스토리지 | Firebase Storage |
| 서버 함수 | Cloud Functions v2 (Node 22, 리전 `asia-northeast3`). 대부분 callable 함수 |
| 실시간 | Firestore onSnapshot (내 정보·알림·댓글·채팅·같이 달리기) |
| 푸시 알림 | FCM (`@react-native-firebase/messaging`) |
| 지도 | 지도 SDK 없음. 기록 상세는 WebView 안의 Leaflet + OpenStreetMap 타일, 목록 썸네일은 SVG 경로 |
| GPS | `@react-native-community/geolocation` + Android 네이티브 포그라운드 서비스(`RunTracking.kt`) |
| 공유 카드 | `react-native-view-shot`(카드 캡처), `react-native-share`, `react-native-image-picker` (카메라 필터 없음) |
| 사투리 | 자체 구현 `src/locales` (JSON 5종 + `DialectProvider`) |
| 로컬 저장 | `@react-native-async-storage/async-storage` (기록 outbox, iOS 진행 중 기록) |
| 캐릭터 | PNG(Storage) + `rive-react-native` (승인된 `.riv` 파일은 아직 없음) |
| 인앱결제 | 없음 (미구현) |
| 폰트 | Pretendard (SIL OFL, `android/app/src/main/assets/fonts`, `ios/DalRyoTemp/Fonts`) |
| 아이콘 | lucide-react-native + react-native-svg |
| iOS 빌드 | GitHub Actions `macos-15` + Xcode 16.4, 서명 없는 IPA (`.github/workflows/ios.yml`, 수동 실행) |

---

## 기능 ID 체계

```
F-{도메인}-{번호}

AUTH      인증 / 온보딩
RUN       달리기 코어
PARK      공원 달리기
TOGETHER  같이 달리기
CHAR      캐릭터 시스템
FEED      오운완 피드 / 소셜
CAM       카메라 필터
INFL      인플루언서 시스템
I18N      사투리 / 지역화
NOTIF     알림
PROFILE   프로필 / 설정
```

---

## Firestore 컬렉션 구조

필드·권한·서버 함수는 [firestore_schema.md](firestore_schema.md)에 있다. 요약:

```
users/{uid}                         비공개 사용자 정보 (본인만 읽음)
  └─ character/{uid}                캐릭터 (문서 1개)
  └─ notifications/{notifId}        앱 안 알림
  └─ inventory · blocks · hidden_posts · room · room_invites
handles/{userId}                    아이디 중복 방지
runs/{runId}                        달리기 기록 (본인 생성)
posts/{postId}                      게시물
  └─ comments/{commentId}           댓글 (답글 포함)
  └─ likes/{uid}                    응원
follows/{followerId_followingId}    팔로우 관계
bookmarks/{uid_postId}              저장한 게시물
conversations · group_conversations 1:1·그룹 채팅 (+ messages)
together_rooms/{roomId}             같이 달리기 방
  └─ members/{uid}                  참여자 진행 상황
parks/{parkId}                      공원 (OSM)
  └─ courses/{courseId}             등록 코스
  └─ weeks/{월요일}/runners/{uid}    주간 랭킹
```

원칙: 앱은 가입·프로필 일부·runs 생성·알림 읽음·같이 달리기 진행 상황만 직접 쓴다. 나머지 쓰기는 서버 함수가 한다.
피드는 팔로워에게 복사하지 않고(Fan-out 없음) 서버가 요청 때 만든다.

---

## Firebase 초기화

`@react-native-firebase`는 네이티브 설정 파일에서 프로젝트 정보를 읽으므로 `initializeApp()`을 부르지 않는다.

- Android `android/app/google-services.json`, iOS `ios/DalRyoTemp/GoogleService-Info.plist` (둘 다 Git에 넣지 않는다. iOS CI는 Secret에서 복원)
- iOS는 `AppDelegate.swift`에서 `FirebaseApp.configure()`를 React Native 시작 전에 호출한다

```ts
// src/lib/firebase.tsx
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import functions from '@react-native-firebase/functions';
import messaging from '@react-native-firebase/messaging';
export { auth, firestore, storage, functions, messaging };

// 서버 함수 호출 (서비스마다 같은 형태, 예: src/services/social.service.ts)
httpsCallable(getFunctions(getApp(), 'asia-northeast3'), 'socialAction')({ action, ...input });
```

---

## AUTH — 인증 / 온보딩

### F-AUTH-01 · 시작 화면

- 달료 로고 + 서브타이틀 "함께 달리는 즐거움!"
- 캐릭터(오리+토끼) 달리기 배경 (`bg-day.png` / `bg-dusk.png`, 시간대별 전환)
- "시작하기" 버튼 → F-AUTH-02

**현재 구현** (`App.tsx`, `src/screens/auth/SplashScreen.tsx`)

- 저장된 로그인이 있으면 시작 화면을 건너뛰고 바로 계정을 확인한다. 프로필이 있으면 홈, 없으면 가입(F-AUTH-03)으로 간다.
- 로그인이 없으면 시작 화면 → "시작하기" → 전화번호 인증.
- 홈은 로딩 화면 아래에서 미리 그려 두고, 캐릭터와 이번 주 기록이 준비되면(최대 10초) 로딩 화면을 걷는다.
- 프로필 조회에 실패하면 재시도 화면을 보여 주며 기존 계정을 신규로 보지 않는다.

### F-AUTH-02 · 로그인 화면

요구한 로그인 방식: 휴대폰 OTP, 카카오, Google, Apple, 이메일

**현재 구현** (`src/screens/auth/LoginScreen.tsx`, `src/services/auth.service.tsx`)

- **휴대폰 OTP만 동작한다.** 국내 번호를 `+82` 형식으로 바꿔 `auth().signInWithPhoneNumber()`로 요청하고 `confirmation.confirm(code)`로 확인한다.
- iOS는 reCAPTCHA 웹 인증 뒤 앱으로 돌아오는 URL 스킴(`app-{GOOGLE_APP_ID}`)이 필요하다.
  - CI가 Info.plist에 이 스킴을 넣는다.
  - `AppDelegate`가 번들 ID·스킴이 맞는지 미리 확인하고, 맞지 않으면 원인 코드가 담긴 안내를 띄운다.
- Google·카카오는 화면에 버튼이 없고, 서비스에 "준비 중" 오류만 내는 자리 함수가 있다. Apple·이메일은 없다.
- 로그아웃하면 기기의 FCM 토큰을 지운 뒤 `auth().signOut()`.

### F-AUTH-03 · 온보딩 플로우 (4단계)

```
STEP 1/4  기본 정보 → 이름 / 아이디 / 달료 펫 이름 / 성별 / 외부 링크(선택)
STEP 2/4  신체 정보 → 키(cm) / 몸무게(kg)  (건너뛰기 가능)
STEP 3/4  내 지역 → 현재 위치로 자동 선택 또는 직접 선택(시·도 → 광역시는 구·군, 도는 시·군. 세종은 시·도만). 지역에 맞는 말투가 정해진다
STEP 4/4  알 받기 → 알이 떨어져 통통 튀는 증정 연출 → F-CHAR-01 (부화는 F-CHAR-02)
```

**현재 구현** (`src/screens/auth/OnboardingScreen.tsx`, `src/services/user.service.tsx`)

- **아이디:** 영문 소문자·숫자·`_` 4~20자. 1단계에서 넘어갈 때 `handles/{아이디}`로 중복을 미리 알려 주고, 저장 때 한 번 더 확인한다.
- **현재 위치로 설정:** 위치 권한 → 한 번 위치 조회 → OpenStreetMap Nominatim 역지오코딩으로 시·도를 찾는다. 위치는 저장하지 않는다.
- **저장:** `completeOnboarding()`이 한 트랜잭션에서 `users/{uid}`, `users/{uid}/character/{uid}`(egg), `handles/{아이디}`를 만든다.
  - 규칙이 카운터 0, egg, rabbit·duck만 허용한다.
  - 필드는 [firestore_schema.md](firestore_schema.md)의 users·character 참고.
- **말투:** 지역의 말투 코드를 저장한다(서울·인천 `seoul`, 경기 `gyeonggi`, 강원 `gangwon`은 표준어로 보임).
- **FCM 토큰:** 가입 때가 아니라 설정에서 푸시를 켜면 저장한다.

---

## RUN — 달리기 코어

### F-RUN-01 · 달리기 목표 설정

홈 중앙 달료 버튼 탭 → 바텀시트:

```
목표 선택
├─ 자유 달리기
├─ 목표 시간  → 드럼롤 (분 단위)
├─ 목표 거리  → 드럼롤 (0.5km 단위)
└─ 목표 칼로리 → 드럼롤 (50kcal 단위)
→ 캐릭터 선택
→ 설정 확인
→ 카운트다운 3초
→ 달리기 시작
```

**현재 구현** (`src/screens/run/RunStartSheet.tsx`, `GoalValueScreen.tsx`)

- 하단 탭 가운데 "달리기" 버튼 → 시트 2×2(자유·시간·거리·칼로리) + 공원 버튼(F-PARK).
- 자유 달리기는 바로 시작한다. 나머지는 목표 값 화면에서 큰 숫자 ± 버튼과 자주 쓰는 값으로 고른다.
  - 시간: 5분 단위, 5~180분
  - 거리: 0.5km 단위, 0.5~42.2km
  - 칼로리: 50kcal 단위, 50~1,500kcal
- 캐릭터 선택·설정 확인 단계는 없다. 고르면 바로 3초 카운트다운 후 시작한다.

### F-RUN-02 · 달리기 화면 (실시간)

```
[헤더] < 자유 달리기    ✕
[시간] 00:06:23
[데이터] 거리(km) | 페이스(min/km) | 칼로리
[지도] GPS 경로 라인 + 달료 캐릭터 아이콘
[하단] 🔒 잠금 | ⏸ 멈쵸! | 📍 위치 고정
```

**현재 구현** (`src/screens/run/RunningScreen.tsx`)

- **화면:**
  - 목표 이름과 그만두기(✕, 확인 창), 큰 거리(km)
  - 시간 · 현재 페이스 · 평균 페이스 · 칼로리, 목표 진행 막대
  - 실제 속도로 흐르는 횡스크롤 월드(`RunningWorld`) 위를 달리는 캐릭터
  - 1km마다·목표 첫 달성 때 말투 응원 말풍선
- **조작:** 일시정지 → (종료 / 계속 달리기).
- **아직 없는 것:** 실시간 지도, 잠금, 위치 고정.
- **기록 엔진** (`src/hooks/useRunSession.tsx`):
  - Android: 네이티브 포그라운드 위치 서비스(`RunTracking.kt`)가 JS와 상관없이 거리·경로·시간을 기록하고, 기기 파일에 5초마다 저장한다.
  - iOS: `RunAccumulator`(`src/utils/runSession.ts`)가 각 위치의 측정 시각으로 거리를 이어 계산한다.
- **위치 거르기:**
  - 정확도 25m 초과는 버린다.
  - 짧은 간격에서 45km/h를 넘게 튄 위치는 버린다.
  - 30초~30분 공백은 평균 25km/h 이하일 때만 거리에 더하고, 30분이 넘는 공백은 잇지 않는다.
  - 경로점은 5m 이상 움직였을 때만 추가한다.
- **현재 페이스:** GPS 속도(평활값)를 초/km로 바꾼다. 5초 동안 위치가 없으면 —로 표시한다.
- **속도 구간별 모션** (`src/utils/motion.ts`): 0.5km/h 이하 쉬기, 6km/h 미만 느릿느릿, 11km/h 미만 달려달려, 그 이상 질주본능.

### F-RUN-03 · 운동 기록 저장

**현재 구현** (`src/services/run.service.tsx`, `runOutbox.service.ts`, `src/hooks/useRunRecovery.ts`)

```ts
// 기록 ID는 시작 시각으로 정한다. 재시도·자동 동기화가 겹쳐도 한 건만 남는다
const runRef = firestore().collection('runs').doc(`${uid}_${startedAt.getTime()}`);
await runRef.set({
  run_id: runRef.id, uid, goal_type, goal_value,
  started_at: Timestamp.fromDate(startedAt), ended_at: serverTimestamp(),
  duration_sec, distance_km, avg_pace_sec, avg_speed_kmh, avg_heart_rate: null,
  calories, route,             // {lat, lng, timestamp}[]
  park_id, course_id?,         // 공원 달리기일 때 (규칙이 실제 공원·코스만 허용)
  exp_earned: 0,               // 앱은 항상 0 (규칙 강제)
  created_at: serverTimestamp(),
});
```

- **저장 순서:**
  1. 끝나면 계정별 기기 outbox(AsyncStorage)에 먼저 보관한다.
  2. 서버로 올린다. 8초가 넘으면 기기 사본을 두고 넘어간다.
  3. 앱 실행·전경 복귀·전경 15초마다 다시 올린다.
- **복구:** 앱이 강제로 꺼지면 다음 실행 때 복구 화면에서 이어 달리기·마무리 저장·버리기를 고른다.
- **서버 반영:** 앱은 `runs`만 만든다. 누적 거리·경험치·스탯·단계·돌 해제는 **`onRunCreate`가 서버에서 반영**한다(F-CHAR-04).
- **칼로리 근사:** 체중(kg, 없으면 60) × 거리(km) × 1.036.

### F-RUN-04 · 운동 완료 화면

```
총 거리 | 평균 페이스 | 소요 시간 | 칼로리
달료 완주 리액션 애니메이션 + t('run.complete') 사투리
  (달리기 전 stage가 'egg'면 알 부화 연출로 대체 → F-CHAR-02)
[달료랑 사진 찍기] → F-CAM-01
[운동 기록 보기]
```

**현재 구현** (`src/screens/run/CompletedRunScreen.tsx`, `RunCompleteScreen.tsx`)

- 개인·같이 달리기가 같은 완료 화면을 쓴다.
- 시작 시점의 단계·누적 거리·돌 상태로 부화·해동·성장·완주 연출을 고른다(`src/utils/reveal.ts`, `runCompletion.ts`). 서버 반영 전에도 미리 보여 줄 수 있다.
- 거리·시간·평균 페이스·칼로리, 경로 미리보기, 다음 단계 진행 막대를 보여 준다.
- 버튼 "달료랑 사진 찍기" → 공유 스튜디오(F-CAM), "기록 보기" → 기록 상세, 닫기 → 홈. 공유에서 돌아와도 연출을 다시 틀지 않는다.

### F-RUN-05 · 운동 기록 화면 (캘린더)

3가지 상태:
- 기록 있음 → 상세 데이터 + GPS 경로 지도
- 선택 전 → 월간 누적 통계
- 기록 없음 → 달료 캐릭터 + `t('record.empty')`

**현재 구현** (`src/screens/run/RecordScreen.tsx`, `RunDetailScreen.tsx`)

- **조회:** `fetchMonthlyRuns()` → `runs`에서 `uid ==` 본인, `started_at` 월 범위, `started_at desc`.
- **기본 화면:**
  - 월간 요약(총 거리·시간·칼로리, 평균 페이스 = 총 시간 / 총 거리)
  - 러닝 저널(기록 카드마다 저장된 경로의 SVG 썸네일)
  - 캘린더 탭에서 날짜를 고르면 그날 기록만 거른다. 월 이동, 오늘 보기, 당겨서 새로고침.
- **기록 상세:** 수치, WebView 안의 Leaflet 지도(START/FINISH, 구간 색 그라데이션), 오운완 카드로 이동.
- 로딩·실패(재시도)·빈 결과를 구분한다(`useRunRecords`).

---

## PARK — 공원 달리기

현재 구현: `src/screens/parks/ParksScreen.tsx`, 서버 `parkAction` (`functions/src/parks.ts`). 달리기 시작 시트의 공원 버튼으로 들어간다.

### F-PARK-01 · 주변 공원 탐색

- `parkAction({action: 'nearby', lat, lng})`가 내 주변 10km 공원을 최대 50개, 가까운 순으로 돌려준다.
- 서버는 공개 OpenStreetMap 데이터(Overpass, Private.coffee)를 조회한다.
  - 외부에는 0.01도 격자 중심만 보내고 UID나 정확한 위치는 보내지 않는다.
  - 받은 공원은 `parks/{osm_...}`에 저장하고 24시간 캐시한다(`park_search_cache`).
  - 사용자별 검색 간격은 30초다.
  - 공급자가 실패하면 7일 이내 캐시를 "오래된 정보"로 보여 준다.

### F-PARK-02 · 코스 선택

- `parkAction({action: 'courses', parkId})`가 `parks/{parkId}/courses`의 등록 코스를 거리순으로 최대 30개 돌려준다. 앱·서버는 코스를 만들어 내지 않는다.
- 코스를 고르거나, 등록 코스가 없으면 3km / 5km / 10km 거리 목표를 고른다 → F-RUN-01 `goal_type='distance'`로 개인 달리기 시작.
- 기록에는 `park_id`와 고른 `course_id`가 남고, 기록 상세에 공원·코스 이름을 표시한다.

### F-PARK-03 · 공원 랭킹

- 공원 달리기가 저장되면 `onRunCreate`가 `parks/{parkId}/weeks/{한국 시간 월요일}/runners/{uid}`에 주간 거리·횟수를 더한다. 거리 0이거나 성장에서 제외된 기록은 빠진다.
- `parkAction({action: 'rankings', parkId})`가 이번 주 상위 50명을 돌려준다. 원본 runs·users는 공개하지 않는다.

---

## TOGETHER — 같이 달리기

현재 구현: `src/screens/together/TogetherScreen.tsx`, `TogetherTrack.tsx`, 서버 `roomAction` (`functions/src/rooms.ts`).
커뮤니티 피드·메시지 화면의 "같이 달리기", 친구 프로필의 "같이 달리기 요청", 알림으로 들어간다.

### F-TOGETHER-01 · 방 생성

방 코드·공개 방 목록 없이 **친구(서로 팔로우한 사이)에게 요청**하는 방식이다.

- **만들기:** `roomAction({action: 'create', roomId, title, goalKm, inviteUids})`. 친구 1~19명, 방 최대 20명, 목표 0.1~100km.
  - 방 ID는 앱이 미리 만들어 재시도해도 한 번만 생긴다.
  - 요청받은 친구에게 `room_invites`·알림·푸시가 간다.
- **받은 사람:** 같이 달리기 화면의 "받은 요청"에서 `join` 또는 `decline`.
- **대기실:** 응답을 기다리는 친구가 보이고, 방장은 시작 전에 `invite`로 친구를 더 부를 수 있다.
- **시작:** 방장이 `start`하면 응답하지 않은 요청은 사라진다.
- **제한:**
  - 한 사람은 한 방에만 들어간다(`users/{uid}/room/active`).
  - 대기 방은 12시간, 시작한 방은 24시간 뒤 만료된다.
  - 방장이 나가면 남은 사람에게 방장을 넘긴다.
- 방과 참여자 기록은 방장과 요청받은 친구(participants)만 읽을 수 있다.

### F-TOGETHER-02 · 실시간 위치 공유

- 각자 일반 달리기 화면(`RunningScreen`)으로 달리며 5초마다 자기 member 문서의 `current_km`·`pace_sec`·`state`(active/paused)를 직접 고친다.
  - 규칙상 방이 running일 때만 가능하고, 거리는 줄어들 수 없다.
- 모든 참여자를 `onSnapshot`으로 구독해 `current_km` 순으로 줄 세우고, 트랙 위에 각자의 캐릭터(펫)를 보여 준다(`TogetherTrack`).
- 목표 거리에 닿으면 자동으로 완주한다. 기록은 일반 달리기와 같은 방법으로 저장한 뒤 `roomAction('finish')`로 방에 알린다.
  - 저장 뒤 방이 이미 닫혔으면 다시 만들지 않는다.
- 위치 좌표는 공유하지 않고 거리·페이스만 공유한다.

---

## CHAR — 캐릭터 시스템

### 캐릭터 에셋

Firebase Storage `characters/{type}/{type}_{S|M|L}.png` — 37종 × 3단계

```
bear capybara cat cheetah chick chicken cow crocodile deer dog duck eagle
elephant fox frog giraffe goldpig gorilla hamster hippo horse koala lion
monkey ostrich otter penguin pig platypus quokka rabbit raccoon sheep
sparrow squirrel tiger zebra
```

| 단계 | 이미지 | 조건 (total_km) |
|------|--------|-----------------|
| `egg` | 로컬 `egg.png` (부화 시 `broken_egg.png`) | 0 (첫 달리기 전) |
| `baby` | `{type}_S.png` — 아기, 기어가기 | 첫 달리기 완료 (> 0) |
| `child` | `{type}_M.png` — 어린이, 깡충 뛰기 | 50 이상 |
| `runner` | `{type}_L.png` — 러너, 전력 질주 | 200 이상 |

- `goldpig`는 특별 캐릭터 (뽑기·보상용)
- **가입 선물은 토끼(`rabbit`)·오리(`duck`)만.** 나머지 35종은 향후 상점 알 뽑기 대상이다(미구현). 정책: [docs/character-availability.md](docs/character-availability.md)
- Storage 규칙: 로그인 유저 읽기만 허용, 업로드는 콘솔에서만

### F-CHAR-01 · 알 지급 (온보딩)

**현재 구현** (`src/services/character.service.tsx`, `src/types/character.types.tsx`)

```ts
// STARTER_CHARACTER_TYPES = ['rabbit', 'duck'] 중 무작위
const type = pickStarterCharacter();

// 가입 트랜잭션(completeOnboarding) 안에서 users·handles와 함께 만든다
tx.set(characterRef, {
  uid, stage: 'egg', character_type: type, pet_name,
  exp: 0, stat_stamina: 0, stat_speed: 0, stat_endurance: 0,
  last_active_at, created_at, updated_at,   // serverTimestamp()
});
```

규칙이 egg·rabbit/duck·0값을 강제하고, 이후 앱은 캐릭터를 고칠 수 없다.

### F-CHAR-02 · 부화 연출

- 위치: 운동 완료 화면 (`src/screens/run/RunCompleteScreen.tsx`), 온보딩에서는 알만 증정
- 조건: 달리기 전 `stage === 'egg'` 이고 이번 거리 > 0
- 연출: 알 흔들림 → `broken_egg.png` + `{type}_S.png` 튀어나옴 (부화 끝나야 버튼 활성)
- `character.stage = 'baby'` 업데이트는 서버(Cloud Function)에서 처리 — 클라이언트는 character 수정 불가(Security Rules)
- 캐릭터 타입 공개 + 이름 짓기 (선택)

### F-CHAR-03 · 속도 연동 모션

```ts
// src/utils/motion.ts
type CharacterMotion = 'idle' | 'rest' | 'slow' | 'run' | 'sprint' | 'stone'

function getMotion(speedKmh: number, isFrozen = false): CharacterMotion {
  if (isFrozen) return 'stone'
  if (speedKmh <= 0.5) return 'rest'
  if (speedKmh < 6) return 'slow'
  if (speedKmh < 11) return 'run'
  return 'sprint'
}
```

### F-CHAR-04 · EXP 적립 및 성장

```ts
// EXP 공식
const baseExp = distanceKm * 10
const itemMultiplier = userItem?.multiplier ?? 1.0
const streakBonus = getStreakBonus(consecutiveDays)  // 최대 1.5
const expEarned = Math.floor(baseExp * itemMultiplier * streakBonus)

// 성장 단계 (total_km 기준) — src/utils/exp.tsx
function getStage(totalKm: number): CharacterStage {
  if (totalKm >= 200) return 'runner'  // _L
  if (totalKm >= 50)  return 'child'   // _M
  if (totalKm > 0)    return 'baby'    // _S (첫 달리기에서 부화)
  return 'egg'
}

// 스탯 증가량 (각 스탯 최대 100)
stat_stamina   += Math.floor(distanceKm * 0.5)
stat_speed     += Math.floor(avgSpeedKmh * 0.3)
stat_endurance += Math.floor(durationSec / 60 * 0.2)
```

**서버 반영 — `functions/src/onRunCreate.ts`** (runs 생성 트리거, 리전 asia-northeast3)

- 트랜잭션으로 run·user·character를 함께 갱신, `runs.growth_applied`로 중복 반영 방지
- 단계는 되돌아가지 않음, 단계가 오르면 `notifications`에 `level_up` 생성
- 평균 속도 25km/h 초과 기록은 `flagged: true`, 거리·EXP·스탯 미반영 (차량 이동 방지)
- 성장 규칙은 `functions/src/growth.ts`와 `src/utils/exp.tsx`가 같아야 함
  (앱은 완료 화면 미리보기용, 최종 값은 서버)

### F-CHAR-06 · 캐릭터 렌더링 & 꾸미기 구조

캐릭터는 반드시 `src/components/character/CharacterView.tsx` 하나로만 그린다.

```tsx
<CharacterView
  type="duck" stage="baby"
  motion="run"                 // idle | rest | slow | run | sprint | stone
  equipped={character.equipped} // 장착한 아이템 id (보관함)
  outfitLayers={{hat, top}}    // 슬롯별 이미지 (옵션, 아직 쓰는 화면 없음)
  size={220}
/>
```

- **원칙: 최소한의 움직임.** 입체 일러스트 한 장을 늘리거나 접으면 고무처럼 보이므로(부위 변형·2D 리그 시도 모두 검수 탈락),
  그림은 '스티커'처럼 통째로만 움직이고 생동감은 주변 효과·연출로 낸다 (`CharacterView`)
  - 대기: 느린 숨쉬기(1.5% 이내), 알은 가끔 좌우로 흔들림
  - 달리기: 살짝 앞으로 기울인 채 걸음 박자에 맞춘 아주 작은 들썩임 + 흙먼지(`dust`)
  - 효과(`CharacterEffects`): 달리기·질주 땀방울, 질주 속도선 (작은 아바타에서는 끔)
  - `facing`(좌우 방향), `jumpKey`(값이 바뀔 때 톡 튀었다 돌아오기)
- **홈 로비** (`LobbyCharacter`): 제자리에서 숨쉬기. 8~12초마다 뒤돌아보기(카드 뒤집듯) 또는 머리 위 ♪/반짝임.
  탭하면 톡 튀기 + 하트 + 대사 변경(`SpeechBubble`). 알·돌 상태는 혼자 행동하지 않음
- **달리기 응원**: 1km마다, 목표를 처음 달성했을 때 머리 위 말풍선 3.5초 (지역 말투 반영)
- **달리기 완료 연출** (`CharacterReveal`, `components/celebrate/`): 캐릭터 등장 → 기록 카운트업 → 경험치 막대 → '완주!' 도장 → 버튼 활성화
  - 완주: 톡 등장 + 반짝임 / 부화: 알이 점점 세게 흔들림 → 번쩍 → 깨진 껍데기에서 등장 + 빛줄기 + 색종이
  - 성장: 이전 모습 → 하얀 실루엣으로 이전·다음 모습이 점점 빠르게 교차 → 번쩍 → 새 모습 + 빛줄기 + 색종이
  - 해동: 돌 상태로 부르르 → 조각이 튀며 원래 색으로 / 우선순위 규칙은 `utils/reveal.ts`
  - 개발 빌드: 설정 → 캐릭터 미리보기 (개발용) → '달리기 완료 연출'에서 네 가지를 저장 없이 재생
- **달리기 월드** (`RunningWorld`): 구름·먼 언덕·가까운 땅이 다른 속도로 흐르는 횡스크롤(패럴랙스).
  흐르는 속도 = 실제 달리기 속도(km/h, 1km/h 단위), 멈추면 월드도 멈춘다
- **Rive 애니메이션** (`RiveCharacter`, 앱 연결 완료 · 동물별 `.riv` 파일 제작 대기. 이족 토끼 시제품은 시각 검수 탈락으로 기본 적용하지 않는다):
  - Storage `characters/{type}/{type}.riv`가 있으면 그 동물은 Rive로, 없으면 위 PNG 애니메이션으로 그린다
  - 아트보드 `baby`·`child`·`runner`, 상태 머신 `Character`, 입력 `speed`·`running`·`stone`·`jump`
  - 파일·아트보드·상태 머신 오류면 PNG로 자동 대체, 그 외 경고는 무시
  - 걷기 이동·방향·먼지·월드·화면 코드는 그대로 쓰고 몸의 움직임만 Rive가 맡는다
  - 제작 규격: `docs/rive-character-spec.md`
- **꾸미기 슬롯**: `back`(몸 뒤) → 몸 → `bottom` → `top` → `shoes` → `hat` → `accessory`
- **PNG 레이어 규칙**: 옷 이미지는 각 동물·단계의 몸 이미지와 같은 캔버스 크기·기준점으로 제작
  (동물 37종 × 3단계마다 체형이 달라 공용 옷 1장으로는 맞지 않음 → Rive에서는 슬롯별 교체 이미지 에셋으로 해결)
- **데이터**: `character.equipped = {back: itemId, ...}`,
  보유 아이템은 `users/{uid}/inventory/{itemId}` (서버만 쓰기) — firestore_schema 참고
- **현재 아이템** (`functions/src/itemCatalog.ts`, 보관함 `InventoryScreen` · 서버 `inventoryAction`):
  몸에 입히는 옷 대신 모든 동물에 맞는 주변 장식 4종이다.
  새싹빛·응원별은 기본 지급, 노을빛은 누적 5km, 꽃잎 응원은 10km에 받는다.
  미리보기는 앱에서만 하고, 장착 버튼을 눌러야 저장된다.
- **디자인 토큰**: 색·간격·모서리·글자 크기는 `src/theme/index.ts`에서만 정의.
  새 화면은 토큰을 쓰고, 리디자인은 토큰부터 바꾼다
- **캐릭터 연출**: 발밑 그림자(`grounded`, 뛰면 작아짐), 화면별로 연한 초록 원·카드 배경 위에 둔다

### 디자인 시스템

| 항목 | 규칙 |
|---|---|
| 색 | **블루 원톤(2026-11-25 결정).** 비율은 중성색 70 · 보조색 25 · 주조색 5. 주조색 파랑(`primary` #0A66C2, 다크 #1F6FEB, 두 테마 모두 흰 글자)은 누를 수 있는 것(달리기·주요 버튼·현재 탭·선택한 칩)·진행 상태·화면마다 핵심 숫자 하나에만. 보조색 하늘(`secondary`·`secondarySoft`)은 요약 띠·차트·달린 날 표시에. 중성은 푸른 기운의 쿨 그레이. 시맨틱은 따로: 성공 `success`, 경고 `accent`, 오류 `danger`. 초원·하늘 장면 그림의 색은 캐릭터 세계라 그대로. 이전 민트 브랜드([docs/design-refresh.md](docs/design-refresh.md))는 이 결정으로 바뀌었다. 컨셉 비교: https://claude.ai/artifact/5vwWSiQYi7C46wQJ6WKBiw |
| 글자 | Pretendard. `AppText`의 variant로만 지정 (display·title·heading·subheading·body·caption·label·number). 커스텀 폰트에 `fontWeight`를 같이 주지 않는다 |
| 아이콘 | lucide 선 아이콘만 사용. 유니코드 기호(⌂ ✧ ⌕ 등)·이모지로 아이콘을 대신하지 않는다 |
| 깊이 | 그림자는 최소(`shadow.card`), 영역은 얇은 선으로 나눈다 |
| 공용 컴포넌트 | `src/components/ui` — `AppText`, `Button`(primary/secondary/ghost), `IconButton`, `Card`(surface/soft/warm/stone/flat), `Badge`, `ProgressBar`, `ScreenHeader`, `ActionSheet`(아래에서 올라오는 메뉴), `PhotoSourceSheet`, `FullPhoto`, `BackgroundTaskToast`, `RunRecordsStatus`, `RunningShoeIcon`(응원 아이콘), `BottomSheet`(댓글 창처럼 아래에서 올라오는 시트), `Chip`(여럿 중 고르는 칩. 고른 칩은 연한 주조색 바탕+주조색 테두리+주조색 글자로 모든 화면이 같다), `TallNumber`(세로로 살짝 늘린 큰 거리 숫자. 성장 1.07배, 기록 1.11배) |
| 하단 탭 | `src/navigation/BottomTabBar.tsx` — 홈·성장·(달리기)·커뮤니티·기록. 가운데 달리기는 탭이 아니라 행동이라 원형 버튼(발자국 아이콘 + "달리기")으로 둔다. 선택 탭은 아이콘 색과 작은 점으로 구분 |
| 무드 | "캐릭터는 귀엽게, 화면은 세련된 러닝 앱처럼". 맑은 하늘 + 초원(장면), 화면은 쿨 그레이 + 파랑 포인트. 장면은 `src/components/scene` (`CompanionScene` 홈·프로필 러닝 메이트 장면, `RunningWorld` 횡스크롤 월드, `MeadowScene` 완료 화면 초원) |
| 버튼 | 입체 턱이 없는 플랫 버튼으로 통일했다. HUD 조각 — `src/components/game/Hud.tsx` (홈의 연속 기록 칩 `StreakChip`) |
| 화면 전환 | 탭은 손가락을 따라 가로로 넘어가고, 설정·알림·보관함·공원·같이 달리기·커뮤니티 하위 화면은 오른쪽에서 밀려 들어온다(`slide.tsx`). 애니메이션 설정은 `src/navigation/motion.ts` 한 곳 |
| 서버 요청 | 응답을 기다릴 필요 없는 요청(게시·응원·읽음 등)은 `runInBackground`로 맡기고 화면은 바로 넘어간다. 진행·실패는 작은 팝업으로 알린다 (`src/services/backgroundTask.service.ts`) |
| 다크 모드 | 설정 → 앱 환경 → 다크 모드 스위치. 이 기기에만 저장한다(`themePreference.service.ts`). 색은 `colors`에서 읽고, 모듈 단위 스타일은 `StyleSheet.create` 대신 **`themedStyles(() => ({...}))`** 로 만든다. 상태 표시줄은 `statusBarStyle()`(화면 전체가 주조색이면 `statusBarOnPrimary()`). 새 화면도 이 규칙을 지켜야 다크 모드를 따라간다. 시작 화면·공유 카드·지도는 일부러 고정색이다. **바탕:** 두 테마 모두 모든 화면이 한 가지 바탕이다(`background`=`surface`, 밝은 테마 #FFFFFF, 다크 #131920: 푸른 기운의 어두운 쿨 그레이). 떠 있는 시트·메뉴·토스트만 `surfaceRaised`(다크 #1C232D). **파랑:** 다크에서도 선명한 파랑(#1F6FEB, 바탕 대비 3.8:1)에 흰 글자(4.6:1). 파랑 글자만 밝은 파랑(`primaryInk` #7DB7FF). 요약 띠(`secondarySoft` #163E77)는 바탕보다 1.7:1 밝은 파랑. 켜고 끄는 스위치는 `switchColors()`(켜지면 파란 동그라미). 시트 뒤 막은 `scrim`. 대비 기준(글자 4.5:1, 버튼 면 3:1)은 `theme.test.ts`가 두 테마 모두 검사한다 |
| 디자인 규칙 | **주조색 글자**(파랑)는 누를 수 있는 것과 블록마다 핵심 숫자 하나에만 쓰고, 이름표·보조 값·목록 아이콘은 중립색(`textMuted`·`text`). **요약 띠**는 보조색(`secondarySoft`)으로 달리기 기록 숫자를 보여 주는 블록(기록 탭 이번 달, 공유한 기록, 첨부한 기록, 같이 달리기 머리 영역, 완료 화면)에만, 고른 상태(선택한 칩·내 말풍선·안 읽은 알림·서브 메뉴 버튼)는 `primarySoft`, 나머지 띠는 회색(`surfaceMuted`). **하위 화면 머리글**은 뒤로 + 왼쪽 제목(`heading`)으로 통일. **숫자**는 세 단계(`number` 24, `numberLarge` 36, `numberHero` 56)와 성장·기록 탭의 `TallNumber`만 쓴다. **빈 화면**에는 바로 할 수 있는 일(달리기 시작·글쓰기) 버튼을 둔다 |

### 화면 구성 (Figma "달료 UI 구성" 반영)

Figma는 구조·기능 참고용이고, 시각 디자인은 위 디자인 시스템으로 다듬어 적용한다.

| 영역 | 구성 |
|---|---|
| 하단 탭 | 홈 · 성장 · (달리기) · 커뮤니티 · 기록. 따로 된 마이 탭은 없다 |
| 헤더 | `ScreenHeader` — 왼쪽은 페이지마다 다르다(홈은 로고, 나머지는 영어 머리말: 성장 `MY PROGRESS`, 기록 `RUNNING JOURNAL`, 커뮤니티 `RUNNER’S CLUB`). 오른쪽 알림·설정은 고정이고, 설정 아이콘은 설정 화면으로 바로 간다 |
| 홈 | 발바닥 표시(글자 없이, 알림·설정보다 살짝 크게)·알림·설정 → 화면 양끝까지 채운 캐릭터 존(초원 장면 위 캐릭터, 이름, LV, 강조한 현재 거리와 작게 곁들인 다음 단계까지 남은 거리, 돌 경고) → 아이템·마이룸·퀘스트 바로가기(마이룸·퀘스트는 "준비 중") → 오늘의 러닝 → 이번 주의 발자국(연속 기록 칩) |
| 달리기 시작 | 탭바 가운데 버튼 → 하단 시트(`RunStartSheet`) 2×2 + 공원: 자유 달리기는 바로 시작, 시간·거리·칼로리는 목표 값 화면(`GoalValueScreen`: 큰 숫자 + ± + 자주 쓰는 값) |
| 달리기 | 큰 거리 → 시간·현재 페이스·평균 페이스·칼로리 → 목표 진행 → 실제 속도로 흐르는 횡스크롤 월드 위를 달리는 캐릭터(흙먼지) → 하단 조작 영역 |
| 운동 완료 | 초원에서 부화·성장·해동·완주 연출 → 거리·기록·경로 미리보기 → 사진 찍기·기록 보기 |
| 성장 | 크게 놓인 누적 거리(키 큰 숫자), 그 아래 한 줄에 최근 7일·EXP → 최근 7일 거리 막대그래프 → 캐릭터 스탯 → AI 코치(준비 중) |
| 커뮤니티 | 피드 위에 하위 화면이 쌓인다. 하단 탭 바로 위의 서브 네비게이션(가운데 버튼을 누르면 피드·탐색·메시지·내 프로필이 펼쳐짐)으로 섹션을 바꾼다. 글쓰기는 피드·탐색·내 프로필 머리글의 + 버튼(화면 아래 떠 있는 버튼은 없앴다) |
| 기록 | 화면 양끝까지 채운 월간 요약 띠(키 큰 거리 숫자) + 러닝 저널(화면 양끝까지 쓰는 줄, 사이는 가는 선), 캘린더 탭 날짜 필터 → 기록 상세(지도) |
| 설정 | 화면 양끝까지 채운 내 프로필 띠, 알림·지역·말투 항목, 다크 모드 스위치, 저장한 게시물, 차단한 사용자, 로그아웃, 회원 탈퇴 (내 프로필은 커뮤니티의 "내 프로필") |

로그인·온보딩은 공통 색·글꼴·버튼 기준만 맞췄고, 시작 화면은 기존 배경 이미지를 유지한다.

### F-CHAR-05 · 돌 변신 스케줄러 (Cloud Function)

**`functions/src/stoneScheduler.ts`** — 매일 00:00 KST, 리전 asia-northeast3

| 마지막 달리기 후 | 처리 |
|---|---|
| 3일째 | 경고 알림 (`warn3`) |
| 5일째 | 경고 알림 (`warn5`) |
| 7일 이상 | `users.is_frozen = true` + 돌 변신 알림 (`stone`) |

- 경고는 **정확히 3일·5일째에만** 보낸다 (매일 반복 발송 방지). 돌이 되면 이후엔 대상에서 빠진다
- `users.last_run_at <= 3일 전` 단일 필드 쿼리 (복합 인덱스 불필요), `is_frozen`은 코드에서 거름
- FCM 푸시 + `notifications`에 `stone_warning`(level) 생성. 문구는 README 5-8 사투리 표 사용
  (서울·경기·강원은 표준어, 5일 경고는 아직 표준어만)
- 해동: 달리기 기록이 저장되면 `onRunCreate`가 `is_frozen = false`
- 규칙(`getStoneLevel`, `getStoneNotice`)은 `functions/src/growth.ts`, 앱은 `src/utils/exp.tsx`

**앱 표시**

- 홈: 러닝 메이트 카드 안에 3일·5일 경고, 7일 이상(또는 `is_frozen`)이면 돌 상태 캐릭터 + 돌 안내 (말투 반영)
- 러너 프로필: 캐릭터 구역에 돌 상태로 표시
- 운동 완료: 돌 상태에서 달렸으면 해동 연출
- 푸시는 사용자가 푸시를 켜고 돌 알림을 끄지 않았을 때만 보낸다

---

## FEED — 오운완 피드 / 소셜

현재 구현: `src/screens/community/CommunityScreen.tsx`(피드·글쓰기·게시물·러너 프로필·탐색·검색·랭킹·저장함), `CommentsSheet.tsx`, `ChatScreen.tsx`, 서버 `socialAction` (`functions/src/social.ts`, `chat.ts`).
**앱은 posts·comments·likes·follows·bookmarks를 직접 쓸 수 없고, 모든 쓰기는 `socialAction`이 트랜잭션으로 한다.**

### F-FEED-01 · 오운완 포스트 작성

- **두 곳에서 쓴다:** 커뮤니티 글쓰기(`Composer`), 달리기 완료·기록 상세의 공유 스튜디오(`ShareStudioScreen`, 오운완 카드 이미지).
- **새 글에는 사진이나 달리기 기록이 꼭 있어야 한다.** 글만 있는 새 글은 앱이 막는다(서버는 예전 앱과 예전 글 때문에 글만 있는 글도 받는다).
- **커뮤니티 글쓰기 순서** (위에서 아래로):
  1. **첨부:** "사진 첨부"(앨범·카메라) 또는 "달리기 기록 첨부" 중 하나. 둘은 서로 바뀐다.
     - 달리기 기록은 아래에서 올라오는 시트(`RunPickerSheet`)의 캘린더에서 날짜를 고르면 그날 기록이 나오고, 하나를 누르면 붙는다. 아직 오지 않은 날·달은 고를 수 없다.
  2. **내용**(1500자)과 **태그**(`#오운완 #달료런`, 따로 입력). 올릴 때 내용 → 📍위치 → #태그 줄로 이어 붙인다(`buildPostText`, 공유 스튜디오와 같다).
  3. **공개 범위**(전체 공개·팔로워 공개·나만 보기)와 **위치 공유** 스위치(기본 끔). 위치는 첨부한 기록의 출발 지점, 없으면 프로필 지역이다. 프로필 지역이 시·도뿐이면(예전 값) 쓰지 않고 설정에서 고르라고 알린다.
  4. **함께 달린 사람:** 서로 팔로우하는 친구를 시트(`RunnerTagSheet`)에서 최대 10명 고른다. 칩의 X로 뺀다.
- **올리는 순서** (`runInBackground`로 맡기고 화면은 바로 넘어간다):
  1. 사진을 `posts/{uid}/...`에 올린다(`src/services/media.service.ts`).
  2. `socialRequest('createPost', {postId, text, imageUrl, runId, visibility, withUids})`를 보낸다.
- **게시물 ID:** 앱이 미리 만든다(`newSocialId()`). 실패 후 다시 눌러도 한 건만 생긴다.
- **서버가 채우는 값:**
  - 작성자 이름·사진·등급을 복사한다.
  - `runId`가 본인 기록이면 거리·페이스·칼로리를 복사한다.
  - 본문의 `#태그`를 최대 10개 뽑는다.
  - `withUids`가 모두 서로 팔로우하는 친구인지 확인하고, 이름을 붙여 `with_runners`로 저장한다. 아니면 글을 만들지 않는다.
- **공개 범위:** `public` / `followers` / `private`. 전체 공개가 아닌 새 글은 피드에 보이지 않으므로 저장 후 내 프로필을 연다.
- **오운완 카드:** 위치는 기본 비공개다. 공개하면 출발 지점을 본문에 넣는다(Nominatim 역지오코딩, 약 1km 단위 좌표만 전송).
- **주소 표기 규칙(프로필 지역·게시물 위치 공통, `src/utils/regions.ts`):** 특별시·광역시는 구·군까지, 도는 시·군까지만 쓴다. 예: 서울 강남구, 부산 기장군, 경기 수원시(영통구는 쓰지 않음), 제주 서귀포시, 세종. 시·도만 알 수 있으면 너무 넓어서 위치로 쓰지 않는다.
- **아직 없는 것:** 날씨(`weather_temp`), 지역 해시태그 자동 추가.
- **수정·삭제:** `editPost`(본문·공개 범위), `deletePost`(본문·사진을 비우고 숨김 처리). 게시물 메뉴(`ActionSheet`)에서 연다. 첨부와 함께 달린 사람은 고칠 수 없다.

### F-FEED-02 · 피드 타임라인

Fan-out(팔로워 피드 복사)은 쓰지 않는다. 서버가 요청 때 목록을 만든다(`src/hooks/useServerFeed.ts`).

- **피드(`homeFeed`):** 내가 팔로우한 사람과 내 글을 최신순으로 두고, 4개마다 추천 글을 하나 끼운다. 아무도 팔로우하지 않았으면 전부 추천 글이다.
- **탐색(`exploreFeed`):** 팔로우하지 않은 사람들의 공개 글을 무작위로 보여 준다. 추천 기준은 아직 없다(`functions/src/explore.ts`).
- **불러오기:** 10개씩, 당겨서 새로고침·더 보기. 새로고침마다 새 `seed`를 보내 순서를 정한다.
- **실시간 갱신:** 목록 자체는 요청 방식이다. 응원·댓글·공유 수와 수정·삭제는 카드마다 자기 글을 지켜봐서 바로 반영된다.
- **카드 모양:**
  - 응원·댓글·공유 수는 각 아이콘 오른쪽에 숫자로 둔다(0이면 숨김, 1만부터 "1.2만"). 숫자와 아이콘은 한 버튼이다. "댓글 n개 모두 보기" 줄은 없다(댓글 아이콘이 댓글 시트를 연다).
  - 사진·기록 아래 본문은 앞에 글쓴이 닉네임을 굵게 붙인다. 닉네임을 누르면 프로필로 간다.
  - 함께 달린 사람이 있으면 "가람, 나래님과 함께 달렸어요" 줄을 두고, 이름을 누르면 그 러너의 프로필로 간다.
- **최신 작성자 정보:** 작성자 이름·사진은 `publicProfiles`로 최신 값을 받아 보여 준다(`usePostAuthor`).
- **거르기:** 차단한 사람·"이 게시물 보지 않음" 글은 서버와 앱 양쪽에서 거른다.

### F-FEED-03 · 좋아요(응원) / 댓글 / 북마크

- **응원(`like`):** 러닝화 아이콘. `{postId, active}`를 보내면 서버가 likes 문서·`like_count`·알림·푸시를 함께 처리한다.
- **저장(`bookmark`):** `{postId, active}`. 설정의 "저장한 게시물"에서 모아 본다.
- **공유(`share`):** 전체 공개 글에만 있다. 시스템 공유 창에서 실제로 공유했을 때만 `{postId}`를 보내고, 서버는 한 사람을 한 번만 센다(`shares/{uid}`, `share_count`). 창을 닫기만 하면 세지 않는다.
- **댓글(`comment`):** `{postId, commentId, text, parentId}`. 피드 위에 아래에서 올라오는 댓글 시트(`CommentsSheet`)에서 쓴다.
  - 답글은 원댓글 아래 스레드로 모이고 앞에 `@이름`이 붙는다.
  - 실패하면 초안과 같은 댓글 ID로 다시 보낸다.
- **댓글 삭제(`deleteComment`):** 댓글 작성자나 게시물 작성자가 한다. 아래 답글까지 지우고 `comment_count`를 줄인다.
- **차단:** 차단 관계면 응원·댓글을 할 수 없다.

### F-FEED-04 · 팔로우 / 언팔로우

- `socialRequest('follow', {uid, following})`가 follows 문서, 양쪽 카운터, 인플루언서 등급, 알림을 한 트랜잭션에서 처리한다. 한 사람이 팔로우할 수 있는 수는 최대 300명이다.
- 팔로워·팔로잉 목록은 `connections`(30명씩)로 받는다. 목록을 비공개로 한 러너는 숫자만 보인다.
- **차단(`blockUser`):** 서로의 팔로우를 끊고 1:1 대화를 막는다. 서로의 글·검색·랭킹·목록에서 빠진다. 설정의 "차단한 사용자"에서 해제한다(팔로우는 복구되지 않음).
- **신고(`report`):** 다른 사람의 게시물(메뉴)·댓글("신고" 글자 버튼)·러너(프로필 메뉴)·대화(채팅방 메뉴)를 신고한다.
  - 시트(`ReportSheet`)에서 이유(스팸·광고, 욕설·괴롭힘, 혐오 표현, 음란·선정적인 내용, 폭력·위험한 행동, 사칭·사기, 개인정보 노출, 기타)를 꼭 고르고, 자세한 내용(500자)은 선택이다.
  - 보내기는 기다리지 않고 작은 팝업으로 알린다. 게시물을 신고하면 그 글은 바로 사라진다(`hidePost`).
  - 서버는 신고 시점의 내용을 `reports`에 함께 남긴다. 검토 화면은 아직 없다.

### F-FEED-05 · 친구 & 랭킹

- **러너 랭킹:** `rankings` — 누적 거리 상위 50명(차단 관계 제외). 커뮤니티 피드 위쪽 "러너 랭킹"에서 연다.
- **러너 검색:** `search` — 닉네임 또는 `@아이디` 앞부분으로 찾는다. 팔로잉 > 나를 팔로우 > 그 외 순이다.
- **러너 프로필:** `profile`, `profileRuns`, `profilePosts`.
  - 캐릭터·스탯·장착 아이템, 최근 러닝, 게시물(목록·2열 보기)을 보여 준다.
  - 러닝 기록과 팔로워·팔로잉 목록은 각각 비공개로 할 수 있다(`setPrivacy`).
- **친구 = 서로 팔로우.** 친구에게는 같이 달리기를 요청할 수 있다(F-TOGETHER).
- **아직 없는 것:** "팔로우 친구 오늘 기록" 목록.

### F-FEED-06 · 메시지 (2단계 기능 앞당겨 구현)

- 1:1·그룹 텍스트 채팅. 커뮤니티 서브 네비게이션의 "메시지"에서 연다.
- **방 만들기:** 1:1 방은 UID 쌍마다 하나다. 그룹은 2~9명을 초대하고, 방 이름을 정하거나 바꿀 수 있다. 그룹에서 나갈 수 있다.
- **보내기:** 실시간 수신, 이전 메시지 50개씩. 같은 메시지 ID로 다시 보내도 한 번만 저장된다.
- **화면:** 같은 사람이 같은 분 안에 보낸 메시지는 묶어서 프로필·시간을 한 번만 보여 준다. 상대 프로필 사진을 누르면 그 사람 프로필로 간다(그룹은 보낸 사람).
- **알림:** 읽음 표시, 안 읽음 점, 방별 푸시 끄기, 1:1 대화 차단을 지원한다.
- **푸시:** 새 메시지 푸시를 누르면 그 대화방이 열린다.
- **아직 없는 것:** 사진·음성 전송, 메시지 삭제.

---

## CAM — 카메라 필터

### F-CAM-01 · 달료 카메라 필터

```tsx
<Camera ref={cameraRef} device={device} isActive>
  <CharacterOverlay stage={character.stage} motion="idle" />
  <RunDataBadge distanceKm={run.distance_km} pace={run.avg_pace_sec} />
  {showDialect && <DialectText text={t('cam.filterComplete')} />}
  <DalryoWatermark />   {/* 우하단 고정, 제거 불가 */}
</Camera>
```

성장 단계별 이펙트: 아기~어린이 기본 / 러너 바람선

**현재: 실시간 카메라 필터는 미구현** (vision-camera 없음). 대신 아래 공유 스튜디오가 있다.

### F-CAM-02 · 외부 공유

**현재 구현** (`src/screens/run/ShareStudioScreen.tsx`)

- **오운완 카드 4:5 만들기:**
  1. 사진을 카메라나 앨범에서 고른다(`react-native-image-picker`, 8MB 미만).
  2. 내 캐릭터와 기록 수치를 켜고 끌 수 있고, 캐릭터를 좌우로 옮길 수 있다. 아이폰 틀 모양의 카드다.
- **외부 공유:** `react-native-view-shot`으로 1080×1350 PNG를 만들어 `react-native-share`로 다른 앱에 보낸다.
- **피드 게시:** 같은 카드를 JPG로 만들어 `posts/{uid}/`에 올리고 게시물로 저장한다(F-FEED-01).
- Storage의 `camera/{uid}/` 경로는 규칙만 있고 쓰지 않는다. 사투리 문구 오버레이는 아직 없다.

---

## INFL — 인플루언서 시스템

### F-INFL-01 · 등급 자동 부여

| 등급 | 팔로워 수 |
|---|---|
| `nano` | 1,000 이상 |
| `micro` | 10,000 이상 |
| `macro` | 100,000 이상 |
| `mega` | 1,000,000 이상 |

**현재 구현:**

- 매일 도는 스케줄러(`tierCalculator`)는 없다. `socialAction`의 `follow`·`blockUser`가 follower_count를 바꿀 때 같은 트랜잭션에서 `influencer_tier`를 다시 계산한다(`functions/src/social.ts`의 `tier`).
- 등급 상승 알림·푸시(`tier_up`)와 앱의 등급 배지 표시는 아직 없다.

### F-INFL-02 · 인플루언서 대시보드

`nano` 이상 유저에게만 노출. 포스트별 조회수·좋아요·공유 통계 집계.

**현재: 미구현.**

---

## I18N — 사투리 / 지역화

### F-I18N-01 · 사투리 설정

**현재 구현** (`src/locales/DialectProvider.tsx`, `translate.ts`)

- **저장:** 설정 → "달료 말투"에서 고르면 `saveAccountSettings`가 `users.dialect`에 저장한다.
- **즉시 반영:** `App.tsx`가 내 users 문서를 실시간 구독하고 `<DialectProvider dialect={user.dialect}>`로 감싸므로, 재시작 없이 바로 바뀐다.
- **화면 사용:** `const t = useDialect(); t('run.start')`. `{{name}}` 같은 변수를 바꿔 넣는다.
- **기본값:** 없는 키는 표준어 문구를 쓴다. `seoul`·`gyeonggi`·`gangwon`이나 알 수 없는 값은 표준어로 보인다.
- **적용 범위:**
  - 적용됨: 홈 대사·탭 반응·돌 안내, 달리기 시작·정지·카운트다운·응원, 일반 완주 문구, 빈 기록 안내, 돌 알림
  - 아직 표준어: 부화·성장 등 특수 연출, 정보성 UI·오류 안내

### F-I18N-02 · 번역 파일 구조

```
src/locales/
  ko-std.json      표준어 (기준)
  ko-gyeong.json   경상도
  ko-jeon.json     전라도
  ko-chung.json    충청도
  ko-jeju.json     제주도
```

### F-I18N-03 · 주요 번역 키 (표준어 기준)

다섯 파일 모두 같은 27개 키를 가진 평평한 구조다(중첩 없음). 기준은 `src/locales/ko-std.json`.

```jsonc
{
  "run.start": "달료!", "run.stop": "멈쵸!", "run.startAction", "run.countdown",
  "run.cheerKm": "{{km}}km ...", "run.cheerGoal", "run.goalStart",
  "run.complete", "run.completeBody": "{{name}} ...",
  "home.hello", "home.ranToday", "home.egg", "home.stone", "home.warning",
  "home.tap1" ~ "home.tap5",
  "record.empty", "record.emptyBody",
  "char.warn3", "char.warn3Body", "char.warn5", "char.warn5Body", "char.stone", "char.stoneBody"
}
```

경상도: `"달려뿌라!"` / `"다 달렸다 아이가!"`. 지역 해시태그(`#경상도달료런`)와 카메라 문구 키는 아직 없다.
서버 푸시 문구는 앱 JSON이 아니라 각 함수에 있다(돌 알림은 `stoneScheduler.ts`에 말투별 문구, 5일 경고는 표준어만).

---

## NOTIF — 알림

### F-NOTIF-01 · FCM 푸시 알림

Cloud Function에서 FCM 발송. 수신자 `dialect` 기준 사투리 문구 적용.

```ts
async function sendFCM(token: string, title: string, body: string) {
  await admin.messaging().send({
    token,
    notification: { title, body },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  })
}
```

| 트리거 | i18n 키 |
|--------|---------|
| 팔로우 | `notif.follow` |
| 응원 | `notif.like` |
| 댓글 | `notif.comment` |
| 캐릭터 성장 | `char.levelUp` |
| 돌 경고 3일 | `char.stoneWarning3` |
| 돌 경고 5일 | `char.stoneWarning5` |
| 돌 변신 7일 | `char.stoneFull` |
| 인플루언서 등급 상승 | `infl.tierUp` |
| 같이달리기 초대 | `together.invite` |

**현재 구현**

- **토큰:** 설정에서 푸시를 켜면 권한을 받고 `users.fcm_token`에 토큰을 저장한다(`usePushNotifications`). 끄거나 로그아웃하면 지운다.
- **푸시를 보내는 곳:**

| 알림 | 앱 안 알림 | 푸시 | 보내는 곳 | 푸시 조건 |
|---|---|---|---|---|
| 팔로우·응원·댓글 | ○ | ○ | socialAction | push 켜짐 + social 켜짐 |
| 같이 달리기 요청 | ○ | ○ | roomAction | push 켜짐 + social 켜짐 |
| 채팅 | × | ○ | socialAction.chatSend | push 켜짐 + 방 음소거 아님 |
| 캐릭터 성장 | ○ | × | onRunCreate | — |
| 돌 경고 3·5일, 돌 변신 7일 | ○ | ○ | stoneScheduler | push 켜짐 + stone 켜짐 (말투별 문구) |
| 인플루언서 등급 상승 | × | × | 없음 | — |

- **문구·소리:** 팔로우·응원·댓글·요청 푸시 문구는 표준어다. iOS 푸시 소리는 `sound: default`, 전경 표시는 `firebase.json`의 `messaging_ios_foreground_presentation_options`.
- **앱이 켜져 있을 때 받은 푸시:** 화면 위 배너로 보여 준다. 채팅 푸시를 누르면 그 대화방, 나머지는 알림 목록이 열린다.
- **알림 목록** (`NotificationsScreen`):
  - 20개씩 보여 주고, 개별 읽음과 안 읽음 점을 지원한다.
  - 사람이 한 행동은 상대 프로필 사진을 보여 준다.
  - 누르면 게시물·프로필·같이 달리기·성장 탭·홈·설정으로 간다.
- **알림 설정 항목:** push·growth·social·stone. growth는 저장만 되고 아직 쓰는 곳이 없다.

---

## PROFILE — 프로필 / 설정

### F-PROFILE-01 · 내 프로필

표시: 닉네임·사진·웹사이트·인플루언서 배지·팔로워/팔로잉·누적 달리기 통계·캐릭터 스탯

**현재 구현** (커뮤니티 → 서브 네비게이션 "내 프로필", `ProfilePage` · `RunnerStatsCard`)

- 내 프로필과 다른 러너의 프로필이 같은 화면이며, 데이터는 `socialAction`의 `profile`·`profilePosts`·`profileRuns`로 받는다.
- **위쪽:** 머리글에 `@아이디`(없으면 닉네임). 내 프로필도 같고 뒤로 가기 버튼만 없다. 사진, 이름, 지역, 게시물·팔로워·팔로잉 수. 다른 러너면 팔로우·메시지 보내기, 친구면 같이 달리기 요청.
- **캐릭터 구역:** 초원 장면 위 캐릭터(장착 아이템 포함), LV·단계, 경험치(다음 단계까지), 체력·속도·지구력, "완료한 러닝 n회" 줄(n회는 이름과 같은 크기에 굵게. 누르면 최근 러닝 말풍선 → 전체 기록).
- **게시물:** 목록·2열 보기.
- **점 3개 메뉴:**
  - 내 프로필: 프로필 설정, 러닝 기록 공개, 팔로워·팔로잉 공개
  - 다른 러너: 신고, 차단·차단 해제
- **아직 없는 것:** 웹사이트 표시, 인플루언서 배지.

### F-PROFILE-02 · 설정

- 프로필 편집 (닉네임·사진·웹사이트·신체 정보)
- 달료 말투 변경 → F-I18N-01
- 알림 항목별 on/off
- 로그아웃: `await signOut(auth)`
- 회원 탈퇴: 서버 `deleteAccount`가 데이터와 계정을 지운다

**현재 구현** (`src/screens/profile/SettingsScreen.tsx`, 헤더의 설정 아이콘)

- **항목 화면:**
  - 프로필: 사진, 캐릭터 이름, 아이디, 닉네임, 웹사이트, 키, 몸무게, 성별
  - 알림: push·growth·social·stone
  - 지역: 시·도를 고르면 그 아래 구·군(광역시)이나 시·군(도)이 나온다. 바꿀 때는 아래 단위까지 골라야 저장된다. 예전에 시·도만 저장한 사용자는 목록에 "경기 · 시·군을 골라 주세요"로 보인다
  - 달료 말투
- **저장:** 항목마다 저장 버튼이 있고 `saveAccountSettings` 한 번으로 저장한다. 저장하지 않고 나가면 확인 창이 뜬다.
- **다크 모드:** 앱 환경 묶음의 스위치. 누르는 즉시 적용하고 이 기기에 저장한다.
- **바로가기:** 저장한 게시물(커뮤니티로 이동), 차단한 사용자, 로그아웃(확인 창), 회원 탈퇴, 개발 빌드의 캐릭터 미리보기.
- **회원 탈퇴** (`DeleteAccountPage`):
  - 지워지는 것(프로필·아이디·캐릭터·보관함, 기록·공원 랭킹, 내 게시물과 사진, 남긴 댓글·응원, 팔로우·저장·차단)과 남는 것(채팅 메시지는 "탈퇴한 러너"로)을 보여 준다.
  - "위 내용을 확인했어요"를 체크해야 버튼이 켜지고, 확인 창을 한 번 더 거친다.
  - 서버 `deleteAccount`가 끝나면 기기의 보내지 못한 기록·알림 토큰을 지우고 로그아웃한다. 실패하면 화면에 남아 다시 시도할 수 있다(이미 지운 것은 이어서 지운다).

---

## Cloud Functions 목록

`functions/src/index.ts`가 내보내는 8개가 전부다. 모두 리전 `asia-northeast3`. 작업별 상세는 [firestore_schema.md](firestore_schema.md).

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `onRunCreate` | runs 생성 | EXP·누적 거리·스탯·성장 단계 반영, 돌 변신 해제, 공원 주간 랭킹, 성장 알림 |
| `stoneScheduler` | 매일 자정 (KST) | 3·5일 경고, 7일 돌 변신 + FCM 알림 |
| `saveAccountSettings` | callable | 설정 저장 (프로필·아이디·캐릭터 이름·알림 설정·사진) |
| `deleteAccount` | callable | 회원 탈퇴 (데이터·사진·계정 삭제, 채팅은 "탈퇴한 러너"로) |
| `socialAction` | callable | 피드·탐색·검색·랭킹·프로필·팔로우·차단·신고·게시물·응원·저장·댓글·채팅 |
| `roomAction` | callable | 같이 달리기 친구 목록·요청·참가·거절·시작·나가기·완주 |
| `parkAction` | callable | 주변 공원·코스·주간 랭킹 |
| `inventoryAction` | callable (`invoker: 'public'`) | 보관함 조회·보상 지급·장착·해제 |

이전 설계의 `onPostCreate`·`onPostDelete`(Fan-out), `onLikeCreate`·`onLikeDelete`·`onCommentCreate`·`onFollowCreate`·`onFollowDelete`(카운트 트리거), `tierCalculator`(등급 스케줄러)는 만들지 않았다. 그 역할은 `socialAction`이 같은 트랜잭션에서 한다.

---

## 비기능 요구사항

| 항목 | 기준 |
|------|------|
| GPS 정확도 | 오차 10m 이내 |
| 배터리 | 백그라운드 GPS 저전력 모드 |
| 오프라인 | Firestore 오프라인 캐시 기본 지원. 달리기 기록은 기기 outbox에 먼저 보관하고 연결되면 자동 동기화 |
| 이미지 업로드 | Firebase Storage, 최대 10MB (앱은 8MB 미만, 긴 변 1600px로 줄여 올림) |
| 같이달리기 지연 | onSnapshot 1~2초 허용 오차 |
| 사투리 전환 | 앱 재시작 없이 즉시 반영 |
| Firestore 보안 | Security Rules 전 컬렉션 적용 |
| 최소 지원 | iOS 14+ / Android 10+ |
| iOS 빌드 | GitHub Actions Mac Runner |

---

## 구현 우선순위

```
Phase 0 (Week 1):     Firebase 프로젝트 세팅
                       (Auth, Firestore, Storage, Functions, FCM)
                       GitHub Actions Mac Runner 설정

Phase 1 (Week 2~3):   F-AUTH-01, F-AUTH-02, F-AUTH-03

Phase 2 (Week 4~5):   F-RUN-01, F-RUN-02, F-RUN-03, F-RUN-04, F-RUN-05

Phase 3 (Week 6):     F-PARK-01, F-PARK-02, F-PARK-03

Phase 4 (Week 7):     F-TOGETHER-01, F-TOGETHER-02

Phase 5 (Week 8~9):   F-CHAR-01, F-CHAR-02, F-CHAR-03, F-CHAR-04, F-CHAR-05

Phase 6 (Week 10):    F-I18N-01, F-I18N-02, F-I18N-03

Phase 7 (Week 11~12): F-FEED-01, F-FEED-02, F-FEED-03, F-FEED-04, F-FEED-05

Phase 8 (Week 13):    F-CAM-01, F-CAM-02

Phase 9 (Week 14~15): F-INFL-01, F-INFL-02, F-NOTIF-01,
                       F-PROFILE-01, F-PROFILE-02
```

---

*REQUIREMENTS.md v0.6 · 달료 MVP · 2025년 4월 작성, 2026-11-23 현재 구현 반영 · DB: Firebase (Firestore) + Cloud Functions + FCM*
