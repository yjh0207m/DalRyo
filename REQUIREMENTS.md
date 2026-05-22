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
| GPS | react-native-geolocation-service |
| 카메라 | react-native-vision-camera |
| 사투리 | i18next + react-i18next |
| 인앱결제 | react-native-iap |
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
- 캐릭터(펭귄+토끼) 달리기 애니메이션
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
STEP 4/4  달이 탄생! → 캐릭터 알 증정 연출 → F-CHAR-01
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
  route: gpsPoints,   // GeoPoint 배열
  park_id: null,
  exp_earned,
  created_at: serverTimestamp(),
})

// users 업데이트
await updateDoc(doc(db, 'users', uid), {
  total_km: increment(distance_km),
  total_exp: increment(exp_earned),
  last_run_at: serverTimestamp(),
  is_frozen: false,
})
```

### F-RUN-04 · 운동 완료 화면

```
총 거리 | 평균 페이스 | 소요 시간 | 칼로리
달료 완주 리액션 애니메이션 + t('run.complete') 사투리
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

### F-CHAR-01 · 알 지급 (온보딩)

```ts
const types = ['penguin', 'rabbit', 'bear', 'fox']
const type = types[Math.floor(Math.random() * types.length)]

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

- 첫 달리기 완료 후 Lottie 알 깨지는 애니메이션
- `character.stage = 'sprout'` 업데이트
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

// 성장 단계 (total_km 기준)
function getStage(totalKm: number) {
  if (totalKm >= 500) return 'champion'
  if (totalKm >= 200) return 'runner'
  if (totalKm >= 50)  return 'baby'
  if (totalKm >= 10)  return 'sprout'
  return 'egg'
}

// 스탯 업데이트
await updateDoc(doc(db, 'users', uid, 'character', uid), {
  stage: newStage,
  exp: increment(expEarned),
  stat_stamina:   increment(Math.floor(distanceKm * 0.5)),
  stat_speed:     increment(Math.floor(avgSpeedKmh * 0.3)),
  stat_endurance: increment(Math.floor(durationSec / 60 * 0.2)),
  last_active_at: serverTimestamp(),
})
```

### F-CHAR-05 · 돌 변신 스케줄러 (Cloud Function)

```ts
// functions/src/stoneScheduler.ts
export const stoneScheduler = onSchedule('every day 00:00', async () => {
  const now = Date.now()
  const usersSnap = await db.collection('users')
    .where('is_frozen', '==', false)
    .get()

  for (const userDoc of usersSnap.docs) {
    const user = userDoc.data()
    if (!user.last_run_at) continue
    const daysSince = (now - user.last_run_at.toMillis()) / 86400000

    if (daysSince >= 7) {
      await userDoc.ref.update({ is_frozen: true })
      await sendFCM(user.fcm_token, getMsg(user.dialect, 'stoneFull'))
    } else if (daysSince >= 5) {
      await sendFCM(user.fcm_token, getMsg(user.dialect, 'stoneWarning5'))
    } else if (daysSince >= 3) {
      await sendFCM(user.fcm_token, getMsg(user.dialect, 'stoneWarning3'))
    }
  }
})
```

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

성장 단계별 이펙트: 새싹~아기 기본 / 러너 바람선 / 챔피언 파티클

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
| `onPostCreate` | posts 생성 | 팔로워 feed에 Fan-out 복사 |
| `onPostDelete` | posts 삭제 | 팔로워 feed에서 제거 |
| `onLikeCreate` | likes 생성 | like_count +1, 작성자 알림 |
| `onLikeDelete` | likes 삭제 | like_count -1 |
| `onCommentCreate` | comments 생성 | comment_count +1, 작성자 알림 |
| `onFollowCreate` | follows 생성 | 카운트 +1, Fan-out 시작, 알림 |
| `onFollowDelete` | follows 삭제 | 카운트 -1, 피드 정리 |
| `stoneScheduler` | 매일 자정 | 돌 변신 처리 + FCM 알림 |
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
