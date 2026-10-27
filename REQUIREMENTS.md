# REQUIREMENTS.md — 달료 런닝 앱

> Claude Code 작업용 요구사항 명세서 v0.5
> `"F-RUN-02 구현해줘. REQUIREMENTS.md 참고해."` 형식으로 지시

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | 달료 (Dalryo) |
| 플랫폼 | React Native CLI (iOS / Android) |
| 언어 | TypeScript |
| 상태관리 | Zustand |
| 내비게이션 | React Navigation v6 |
| DB | Firestore (NoSQL) |
| 인증 | Firebase Auth |
| 스토리지 | Firebase Storage |
| 서버 함수 | Cloud Functions for Firebase (Node.js) |
| 실시간 | Firestore onSnapshot |
| 푸시 알림 | FCM (Firebase Cloud Messaging) |
| 지도 | react-native-maps |
| GPS | @react-native-community/geolocation (New Architecture 지원) |
| 카메라 | react-native-vision-camera |
| 사투리 | i18next + react-i18next |
| 인앱결제 | react-native-iap |
| 폰트 | Pretendard (SIL OFL, `android/app/src/main/assets/fonts`, `ios/DalRyoTemp/Fonts`) |
| 아이콘 | lucide-react-native + react-native-svg |
| iOS 빌드 | GitHub Actions Mac Runner |

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

```
users/{uid}                         유저 기본 정보
  └─ character/{uid}                캐릭터 (도큐먼트 1개)
  └─ feed/{postId}                  Fan-out 피드 (Cloud Function 관리)
  └─ notifications/{notifId}        인앱 알림

runs/{runId}                        달리기 기록
posts/{postId}                      오운완 게시물
  └─ comments/{commentId}           댓글 (대댓글 포함)
  └─ likes/{uid}                    좋아요

follows/{followerId_followingId}    팔로우 관계
bookmarks/{uid_postId}              북마크

together_rooms/{roomId}             같이 달리기 방
  └─ members/{uid}                  참여자 실시간 위치

parks/{parkId}                      공원 정보
  └─ courses/{courseId}             공원 코스
```

---

## Firebase 초기화

```ts
// lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const app = initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

---

## AUTH — 인증 / 온보딩

### F-AUTH-01 · 시작 화면

- 달료 로고 + 서브타이틀 "함께 달리는 즐거움!"
- 캐릭터(오리+토끼) 달리기 배경 (`bg-day.png` / `bg-dusk.png`, 시간대별 전환)
- "시작하기" 버튼 → F-AUTH-02

### F-AUTH-02 · 로그인 화면

지원 로그인 방식:

```ts
// 휴대폰 OTP (Firebase Auth 기본 내장)
const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
const credential = PhoneAuthProvider.credential(confirmation.verificationId, otp)
await signInWithCredential(auth, credential)

// 카카오 OAuth
await signInWithCustomToken(auth, kakaoCustomToken)  // 서버에서 custom token 발급

// Google
await signInWithPopup(auth, new GoogleAuthProvider())

// Apple
await signInWithPopup(auth, new OAuthProvider('apple.com'))

// 이메일
await signInWithEmailAndPassword(auth, email, password)
await createUserWithEmailAndPassword(auth, email, password)
```

### F-AUTH-03 · 온보딩 플로우 (4단계)

```
STEP 1/4  반가워요! → 닉네임 입력
STEP 2/4  신체 정보 → 키(cm) / 몸무게(kg) / 성별
STEP 3/4  내 지역 → 사투리 선택
STEP 4/4  알 받기 → 알이 떨어져 통통 튀는 증정 연출 → F-CHAR-01 (부화는 F-CHAR-02)
```

```ts
// users/{uid} 도큐먼트 생성
await setDoc(doc(db, 'users', uid), {
  uid,
  email: user.email ?? null,
  phone: user.phoneNumber ?? null,
  display_name: nickname,
  profile_image: null,
  website: null,
  height_cm: null,
  weight_kg: null,
  gender: null,
  total_km: 0,
  total_exp: 0,
  last_run_at: null,
  is_frozen: false,
  influencer_tier: 'none',
  follower_count: 0,
  following_count: 0,
  dialect: selectedDialect,
  fcm_token: await getFCMToken(),
  created_at: serverTimestamp(),
})
```

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

### F-RUN-02 · 달리기 화면 (실시간)

```
[헤더] < 자유 달리기    ✕
[시간] 00:06:23
[데이터] 거리(km) | 페이스(min/km) | 칼로리
[지도] GPS 경로 라인 + 달료 캐릭터 아이콘
[하단] 🔒 잠금 | ⏸ 멈쵸! | 📍 위치 고정
```

```tsx
// 실시간 경로 + 캐릭터 위치
<MapView>
  <Polyline
    coordinates={route.map(p => ({ latitude: p.lat, longitude: p.lng }))}
    strokeColor="#1D9E75"
    strokeWidth={3}
  />
  <Marker coordinate={currentPosition}>
    <DalryoCharacter stage={character.stage} motion={currentMotion} />
  </Marker>
</MapView>
```

속도 구간별 모션:
- `~6 km/h` → 느릿느릿
- `7~10 km/h` → 달려달려
- `11+ km/h` → 질주본능

### F-RUN-03 · 운동 기록 저장

```ts
const runRef = doc(collection(db, 'runs'))
await setDoc(runRef, {
  run_id: runRef.id,
  uid,
  goal_type,
  goal_value,
  started_at,
  ended_at: serverTimestamp(),
  duration_sec,
  distance_km,
  avg_pace_sec,
  avg_speed_kmh,
  avg_heart_rate: null,
  calories,
  route: gpsPoints,   // {lat, lng, timestamp} 배열, 5m 이상 이동 시에만 추가
  park_id: null,
  exp_earned: 0,      // 클라이언트는 항상 0 (Security Rules 강제)
  created_at: serverTimestamp(),
})
```

- 클라이언트는 `runs`만 생성한다. `users.total_km/total_exp/last_run_at/is_frozen`과
  캐릭터 EXP·스탯·단계는 **Cloud Function `onRunCreate`가 서버에서 반영** (F-CHAR-04)
- 거리 측정: 정확도 25m 초과 위치는 버리고, 45km/h 넘게 튄 위치는 GPS 오차로 무시.
  일시정지 중 이동 거리는 합산하지 않음 (`src/hooks/useRunSession.tsx`)
- 칼로리 근사: 체중(kg, 없으면 60) × 거리(km) × 1.036

### F-RUN-04 · 운동 완료 화면

```
총 거리 | 평균 페이스 | 소요 시간 | 칼로리
달료 완주 리액션 애니메이션 + t('run.complete') 사투리
  (달리기 전 stage가 'egg'면 알 부화 연출로 대체 → F-CHAR-02)
[달료랑 사진 찍기] → F-CAM-01
[운동 기록 보기]
```

### F-RUN-05 · 운동 기록 화면 (캘린더)

```ts
// 해당 월 달리기 기록 조회
const q = query(
  collection(db, 'runs'),
  where('uid', '==', uid),
  where('started_at', '>=', monthStart),
  where('started_at', '<=', monthEnd),
  orderBy('started_at', 'desc')
)
```

3가지 상태:
- 기록 있음 → 상세 데이터 + GPS 경로 지도
- 선택 전 → 월간 누적 통계
- 기록 없음 → 달료 캐릭터 + `t('record.empty')`

---

## PARK — 공원 달리기

### F-PARK-01 · 주변 공원 탐색

```ts
// parks 컬렉션에서 GeoQuery (geofirestore 또는 수동 범위 필터)
const parksSnap = await getDocs(collection(db, 'parks'))
const nearby = parksSnap.docs
  .map(d => ({ ...d.data(), distance: calcDistance(userLat, userLng, d.data().lat, d.data().lng) }))
  .filter(p => p.distance <= 10)
  .sort((a, b) => a.distance - b.distance)
```

### F-PARK-02 · 코스 선택

```ts
// 공원의 코스 목록 조회
const coursesSnap = await getDocs(
  collection(db, 'parks', parkId, 'courses')
)
```

3km / 5km / 10km 코스 선택 → F-RUN-01 goal_type='distance'로 연결

### F-PARK-03 · 공원 랭킹

```ts
const q = query(
  collection(db, 'runs'),
  where('park_id', '==', parkId),
  where('started_at', '>=', weekStart),
  orderBy('distance_km', 'desc'),
  limit(50)
)
```

---

## TOGETHER — 같이 달리기

### F-TOGETHER-01 · 방 생성

```ts
const roomRef = doc(collection(db, 'together_rooms'))
await setDoc(roomRef, {
  room_id: roomRef.id,
  host_uid: uid,
  host_name: user.display_name,
  goal_type, goal_value,
  status: 'waiting',
  started_at: null,
  created_at: serverTimestamp(),
})
await setDoc(doc(db, 'together_rooms', roomRef.id, 'members', uid), {
  uid, display_name: user.display_name, profile_image: user.profile_image,
  current_km: 0, current_pace_sec: null, rank: 0,
  joined_at: serverTimestamp(),
})
```

### F-TOGETHER-02 · 실시간 위치 공유

```ts
// 내 위치 업데이트 (1초마다)
await updateDoc(doc(db, 'together_rooms', roomId, 'members', uid), {
  current_km: currentKm,
  current_pace_sec: currentPace,
})

// 전체 참여자 실시간 구독
const unsubscribe = onSnapshot(
  collection(db, 'together_rooms', roomId, 'members'),
  (snap) => {
    const members = snap.docs.map(d => d.data())
    const ranked = members.sort((a, b) => b.current_km - a.current_km)
    setRanking(ranked)
  }
)
```

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

- `goldpig`는 특별 캐릭터 → 가입 시 지급 대상에서 제외 (뽑기·보상용)
- Storage 규칙: 로그인 유저 읽기만 허용, 업로드는 콘솔에서만

### F-CHAR-01 · 알 지급 (온보딩)

```ts
// CHARACTER_TYPES(37종)에서 goldpig 제외 후 랜덤
const starters = CHARACTER_TYPES.filter(t => t !== 'goldpig')
const type = starters[Math.floor(Math.random() * starters.length)]

await setDoc(doc(db, 'users', uid, 'character', uid), {
  stage: 'egg',
  character_type: type,
  exp: 0,
  stat_stamina: 0,
  stat_speed: 0,
  stat_endurance: 0,
  last_active_at: serverTimestamp(),
})
```

### F-CHAR-02 · 부화 연출

- 위치: 운동 완료 화면 (`src/screens/run/RunCompleteScreen.tsx`), 온보딩에서는 알만 증정
- 조건: 달리기 전 `stage === 'egg'` 이고 이번 거리 > 0
- 연출: 알 흔들림 → `broken_egg.png` + `{type}_S.png` 튀어나옴 (부화 끝나야 버튼 활성)
- `character.stage = 'baby'` 업데이트는 서버(Cloud Function)에서 처리 — 클라이언트는 character 수정 불가(Security Rules)
- 캐릭터 타입 공개 + 이름 짓기 (선택)

### F-CHAR-03 · 속도 연동 모션

```ts
type MotionType = 'idle' | 'slow' | 'run' | 'sprint' | 'rest' | 'stone'

function getMotion(speedKmh: number, isFrozen: boolean): MotionType {
  if (isFrozen) return 'stone'
  if (speedKmh === 0) return 'rest'
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
  outfitLayers={{hat, top}}    // 슬롯별 이미지 (옵션)
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
- **달리기 월드** (`RunningWorld`): 구름·먼 언덕·가까운 땅이 다른 속도로 흐르는 횡스크롤(패럴랙스).
  흐르는 속도 = 실제 달리기 속도(km/h, 1km/h 단위), 멈추면 월드도 멈춘다
- **Rive 애니메이션** (`RiveCharacter`, 앱 연결 완료 · 동물별 `.riv` 파일 제작 대기):
  - Storage `characters/{type}/{type}.riv`가 있으면 그 동물은 Rive로, 없으면 위 PNG 애니메이션으로 그린다
  - 아트보드 `baby`·`child`·`runner`, 상태 머신 `Character`, 입력 `speed`·`running`·`stone`·`jump`
  - 파일·아트보드·상태 머신 오류면 PNG로 자동 대체, 그 외 경고는 무시
  - 걷기 이동·방향·먼지·월드·화면 코드는 그대로 쓰고 몸의 움직임만 Rive가 맡는다
  - 제작 규격: `docs/rive-character-spec.md`
- **꾸미기 슬롯**: `back`(몸 뒤) → 몸 → `bottom` → `top` → `shoes` → `hat` → `accessory`
- **PNG 레이어 규칙**: 옷 이미지는 각 동물·단계의 몸 이미지와 같은 캔버스 크기·기준점으로 제작
  (동물 37종 × 3단계마다 체형이 달라 공용 옷 1장으로는 맞지 않음 → Rive에서는 슬롯별 교체 이미지 에셋으로 해결)
- **데이터**: `character.equipped = {hat: itemId, ...}`,
  보유 아이템은 `users/{uid}/inventory/{itemId}` (서버만 쓰기) — firestore_schema 참고
- **디자인 토큰**: 색·간격·모서리·글자 크기는 `src/theme/index.ts`에서만 정의.
  새 화면은 토큰을 쓰고, 리디자인은 토큰부터 바꾼다
- **캐릭터 연출**: 발밑 그림자(`grounded`, 뛰면 작아짐), 화면별로 연한 초록 원·카드 배경 위에 둔다

### 디자인 시스템

| 항목 | 규칙 |
|---|---|
| 색 | 배경 중성 오프화이트(`background`), 브랜드 초록(`primary`)은 누를 수 있는 것·진행 상태에만. 따뜻한 색(`accent`)은 경고·일시정지 같은 감정 신호에만 |
| 글자 | Pretendard. `AppText`의 variant로만 지정 (display·title·heading·subheading·body·caption·label·number). 커스텀 폰트에 `fontWeight`를 같이 주지 않는다 |
| 아이콘 | lucide 선 아이콘만 사용. 유니코드 기호(⌂ ✧ ⌕ 등)·이모지로 아이콘을 대신하지 않는다 |
| 깊이 | 그림자는 최소(`shadow.card`), 영역은 얇은 선으로 나눈다 |
| 공용 컴포넌트 | `src/components/ui` — `AppText`, `Button`(primary/secondary/ghost), `IconButton`, `Card`(surface/soft/warm/stone), `Badge`, `ProgressBar` |
| 하단 탭 | `src/navigation/BottomTabBar.tsx` — 가운데 달리기 버튼은 탭이 아니라 행동이라 크게 띄우고 내 캐릭터를 보여 준다 |
| 무드 | "런닝 + 게임". 맑은 하늘 + 민트 + 초원 월드. 장면은 `src/components/scene` (`RunningWorld` 횡스크롤 월드, `MeadowScene` 초원, `IslandScene` 풀밭 섬) |
| 게임 UI | 입체 버튼(아래 턱이 있고 누르면 눌림) — `Button`, 탭바 가운데 달리기 버튼. HUD — `src/components/game/Hud.tsx` (레벨 배지, 두꺼운 경험치 바, 연속 기록 칩) |

### 화면 구성 (Figma "달료 UI 구성" 반영)

Figma는 구조·기능 참고용이고, 시각 디자인은 위 디자인 시스템으로 다듬어 적용한다.

| 영역 | 구성 |
|---|---|
| 하단 탭 | 홈 · 성장 · (달리기) · 커뮤니티 · 기록 |
| 헤더 | `ScreenHeader` — 왼쪽은 페이지마다(홈은 로고, 나머지는 제목), 오른쪽 알림·설정 고정. 설정 → 마이 페이지 |
| 홈 (게임 로비) | 위: 캐릭터가 돌아다니는 월드 + HUD(플레이어 카드: 레벨 배지·이름·경험치 바, 알림·설정, 연속 기록 칩). 아래 패널: 달리기 시작(입체 버튼) → 오늘 기록 → 이번 주 활동 |
| 달리기 시작 | 탭바 가운데 버튼·홈 버튼 → 하단 시트(`RunStartSheet`) 2×2: 자유 달리기는 바로 시작, 시간·거리·칼로리는 목표 값 화면(`GoalValueScreen`: 큰 숫자 + ± + 자주 쓰는 값) |
| 달리기 | 민트 타이머 → 기록 카드 → 목표 진행 → 실제 속도로 흐르는 횡스크롤 월드 위를 달리는 캐릭터(흙먼지) + 원형 조작 버튼 |
| 운동 완료 | 같은 초원에서 부화·완주 리액션, 기록 카드가 풀밭 위에 놓임 |
| 성장 | 누적·최근 7일·EXP 요약 → 최근 7일 거리 막대그래프 → 캐릭터 스탯 → AI 코치(준비 중) |
| 마이 | 프로필 + 꾸미기·마이룸·아이템·설정 메뉴 |

리디자인 적용 완료: 하단 탭, 헤더, 홈, 달리기 시작 시트, 목표 값, 달리기, 운동 완료, 성장, 마이.
아직 예전 스타일: 시작(Splash), 로그인, 온보딩, 기록, 커뮤니티

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

- 홈: 3일·5일 경고 배너, 7일 이상(또는 `is_frozen`)이면 캐릭터 `motion="stone"` + 돌 배너
- 마이페이지: "돌 변신 중 🪨"
- 운동 완료: 돌 상태에서 달렸으면 "해동 완료!" 문구

---

## FEED — 오운완 피드 / 소셜

### F-FEED-01 · 오운완 포스트 작성

```ts
// Firebase Storage에 이미지 업로드
const storageRef = ref(storage, `posts/${uid}/${Date.now()}.jpg`)
await uploadBytes(storageRef, imageBlob)
const imageUrl = await getDownloadURL(storageRef)

// posts 도큐먼트 생성
const postRef = doc(collection(db, 'posts'))
await setDoc(postRef, {
  post_id: postRef.id,
  uid,
  author_name: user.display_name,    // JOIN 없이 표시하려고 복사
  author_image: user.profile_image,
  author_tier: user.influencer_tier,
  run_id: runId ?? null,
  category: 'feed',
  text,
  image_url: imageUrl,
  distance_km, avg_pace_sec, calories,
  weather_temp: await getWeather(location),
  hashtags: ['오운완', '달료런', getRegionalTag(user.dialect)],
  like_count: 0,
  comment_count: 0,
  visibility: 'public',
  dialect: user.dialect,
  created_at: serverTimestamp(),
})
// → Cloud Function onPostCreate가 팔로워 feed에 Fan-out
```

### F-FEED-02 · 피드 타임라인 (Fan-out)

```ts
// 내 feed 서브컬렉션만 읽으면 됨 (JOIN 없음)
const q = query(
  collection(db, 'users', uid, 'feed'),
  orderBy('created_at', 'desc'),
  limit(20)
)
const unsubscribe = onSnapshot(q, (snap) => {
  const posts = snap.docs.map(d => d.data())
  setFeed(posts)
})
```

### F-FEED-02-FN · Cloud Function — Fan-out

```ts
// functions/src/onPostCreate.ts
export const onPostCreate = onDocumentCreated('posts/{postId}', async (event) => {
  const post = event.data?.data()
  if (!post) return

  // 작성자 팔로워 목록 조회
  const followersSnap = await db.collection('follows')
    .where('following_id', '==', post.uid)
    .get()

  // 팔로워 전원의 feed에 복사 (배치 처리)
  const batch = db.batch()
  for (const followerDoc of followersSnap.docs) {
    const feedRef = db
      .collection('users')
      .doc(followerDoc.data().follower_id)
      .collection('feed')
      .doc(event.params.postId)
    batch.set(feedRef, post)
  }
  await batch.commit()
})
```

### F-FEED-03 · 좋아요(응원) / 댓글 / 북마크

```ts
// 좋아요 토글
const likeRef = doc(db, 'posts', postId, 'likes', uid)
const likeSnap = await getDoc(likeRef)
if (likeSnap.exists()) {
  await deleteDoc(likeRef)
  await updateDoc(doc(db, 'posts', postId), { like_count: increment(-1) })
} else {
  await setDoc(likeRef, { uid, created_at: serverTimestamp() })
  await updateDoc(doc(db, 'posts', postId), { like_count: increment(1) })
}

// 댓글
await addDoc(collection(db, 'posts', postId, 'comments'), {
  uid, author_name: user.display_name, author_image: user.profile_image,
  parent_id: null, text, created_at: serverTimestamp(),
})

// 북마크
await setDoc(doc(db, 'bookmarks', `${uid}_${postId}`), {
  uid, post_id: postId, created_at: serverTimestamp(),
})
```

### F-FEED-04 · 팔로우 / 언팔로우

```ts
// 팔로우
await setDoc(doc(db, 'follows', `${uid}_${targetId}`), {
  follower_id: uid, following_id: targetId, created_at: serverTimestamp(),
})
// → Cloud Function이 follower_count/following_count +1, Fan-out 시작

// 언팔로우
await deleteDoc(doc(db, 'follows', `${uid}_${targetId}`))
// → Cloud Function이 -1, 피드 정리
```

### F-FEED-05 · 친구 & 랭킹

```ts
// 팔로우 친구 오늘 달리기 기록
const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
const runsSnap = await getDocs(query(
  collection(db, 'runs'),
  where('uid', 'in', followingIds.slice(0, 10)),  // Firestore in 제한 10개
  where('started_at', '>=', Timestamp.fromDate(todayStart)),
  orderBy('distance_km', 'desc')
))
```

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

### F-CAM-02 · 외부 공유

```ts
// 촬영 후 Firebase Storage 저장
const storageRef = ref(storage, `camera/${uid}/${Date.now()}.jpg`)
await uploadBytes(storageRef, photoBlob)

// 외부 공유 (워터마크 이미 합성됨)
await Share.open({ url: localImagePath, type: 'image/jpeg' })
```

---

## INFL — 인플루언서 시스템

### F-INFL-01 · 등급 자동 부여 (Cloud Function)

```ts
// functions/src/tierCalculator.ts
export const tierCalculator = onSchedule('every day 00:00', async () => {
  const usersSnap = await db.collection('users').get()
  const batch = db.batch()

  for (const userDoc of usersSnap.docs) {
    const { follower_count } = userDoc.data()
    let tier = 'none'
    if (follower_count >= 1000000) tier = 'mega'
    else if (follower_count >= 100000) tier = 'macro'
    else if (follower_count >= 10000)  tier = 'micro'
    else if (follower_count >= 1000)   tier = 'nano'

    if (tier !== userDoc.data().influencer_tier) {
      batch.update(userDoc.ref, { influencer_tier: tier })
      // 등급 상승 시 FCM 알림
      if (tier !== 'none') {
        await sendFCM(userDoc.data().fcm_token,
          getMsg(userDoc.data().dialect, 'tierUp', { tier }))
      }
    }
  }
  await batch.commit()
})
```

### F-INFL-02 · 인플루언서 대시보드

`nano` 이상 유저에게만 노출. 포스트별 조회수·좋아요·공유 통계 집계.

---

## I18N — 사투리 / 지역화

### F-I18N-01 · 사투리 설정

```ts
// Zustand + Firebase 동기화
await updateDoc(doc(db, 'users', uid), { dialect: newDialect })
i18n.changeLanguage(`ko-${newDialect}`)  // 즉시 반영
```

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

```jsonc
{
  "run": {
    "start": "달료!", "stop": "멈쵸!",
    "begin": "달리기 시작!", "complete": "완료! 잘 달렸어요 🎉",
    "distance": "{{km}}km 달렸어요!"
  },
  "char": {
    "levelUp": "달료가 성장했어요! 🎉",
    "stoneWarning3": "달료가 뻣뻣해졌어요... 빨리 달려주세요!",
    "stoneWarning5": "달료 몸이 회색이 되고 있어요…",
    "stoneFull": "달료가 돌이 됐어요 🪨 오늘 달리면 해동돼요!",
    "stoneThaw": "달료가 녹고 있어요! 🔥"
  },
  "cam": { "filterComplete": "달렸어요!" },
  "feed": { "hashtagRegional": "" },
  "record": { "empty": "이 날은 기록이 없어요 🌱" }
}
```

경상도: `"달려뿌라!"` / `"다 달렸다 아이가!"` / `"#경상도달료런"`

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

---

## PROFILE — 프로필 / 설정

### F-PROFILE-01 · 내 프로필

```ts
const userSnap = await getDoc(doc(db, 'users', uid))
const charSnap = await getDoc(doc(db, 'users', uid, 'character', uid))
const postsSnap = await getDocs(query(
  collection(db, 'posts'),
  where('uid', '==', uid),
  orderBy('created_at', 'desc')
))
```

표시: 닉네임·사진·웹사이트·인플루언서 배지·팔로워/팔로잉·누적 달리기 통계·캐릭터 스탯

### F-PROFILE-02 · 설정

- 프로필 편집 (닉네임·사진·웹사이트·신체 정보)
- 달료 말투 변경 → F-I18N-01
- 알림 항목별 on/off
- 로그아웃: `await signOut(auth)`
- 회원 탈퇴: `await deleteUser(auth.currentUser)`

---

## Cloud Functions 목록

| 함수 | 트리거 | 역할 |
|------|--------|------|
| `onRunCreate` ✅ | runs 생성 | EXP·누적 거리·스탯·성장 단계 반영, 돌 변신 해제, 성장 알림 |
| `onPostCreate` | posts 생성 | 팔로워 feed에 Fan-out 복사 |
| `onPostDelete` | posts 삭제 | 팔로워 feed에서 제거 |
| `onLikeCreate` | likes 생성 | like_count +1, 작성자 알림 |
| `onLikeDelete` | likes 삭제 | like_count -1 |
| `onCommentCreate` | comments 생성 | comment_count +1, 작성자 알림 |
| `onFollowCreate` | follows 생성 | 카운트 +1, Fan-out 시작, 알림 |
| `onFollowDelete` | follows 삭제 | 카운트 -1, 피드 정리 |
| `stoneScheduler` ✅ | 매일 자정 (KST) | 3·5일 경고, 7일 돌 변신 + FCM 알림 |
| `tierCalculator` | 매일 자정 | 인플루언서 등급 업데이트 |

---

## 비기능 요구사항

| 항목 | 기준 |
|------|------|
| GPS 정확도 | 오차 10m 이내 |
| 배터리 | 백그라운드 GPS 저전력 모드 |
| 오프라인 | Firestore 오프라인 캐시 기본 지원 |
| 이미지 업로드 | Firebase Storage, 최대 10MB |
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

*REQUIREMENTS.md v0.5 · 달료 MVP · 2025년 4월 · DB: Firebase (Firestore) + Cloud Functions + FCM*
