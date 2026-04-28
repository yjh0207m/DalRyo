# REQUIREMENTS.md — 달료 런닝 앱

> Claude Code 작업용 요구사항 명세서  
> 기능 ID를 기준으로 구현 지시: `"F-I18N-01 구현해줘. REQUIREMENTS.md 참고해."`

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 앱 이름 | 달료 (Dalryo) |
| 플랫폼 | React Native CLI (iOS / Android) |
| 백엔드 | Firebase (Auth, Firestore, Storage, Functions) |
| 상태관리 | Zustand |
| 내비게이션 | React Navigation v6 |
| 지도 / GPS | react-native-maps, react-native-geolocation-service |
| 카메라 | react-native-vision-camera |
| 다국어 / 사투리 | i18next + react-i18next |
| 버전 | v0.1 MVP |

---

## 기능 ID 체계

```
F-{도메인}-{번호}

도메인:
  AUTH    인증 / 온보딩
  RUN     달리기 코어
  CHAR    캐릭터 시스템
  FEED    오운완 피드 / 소셜
  CAM     카메라 필터
  INFL    인플루언서 시스템
  I18N    사투리 / 지역화 시스템
  NOTIF   알림
  PROFILE 프로필 / 설정
```

---

## AUTH — 인증 / 온보딩

### F-AUTH-01 · 회원가입

- Firebase Auth (이메일 + 소셜 로그인: 카카오, Google)
- 가입 완료 시 Firestore `users` 컬렉션에 유저 도큐먼트 생성
- 가입 완료 즉시 **F-CHAR-01** (알 지급) 트리거

```ts
// users/{uid}
{
  uid: string
  displayName: string
  email: string
  profileImage: string | null
  createdAt: Timestamp
  totalKm: number
  totalExp: number
  lastRunAt: Timestamp | null
  influencerTier: 'none' | 'nano' | 'micro' | 'macro' | 'mega'
  followerCount: number
  followingCount: number
  dialect: 'ko-std' | 'ko-gyeong' | 'ko-jeon' | 'ko-chung' | 'ko-jeju'  // 사투리 설정
}
```

### F-AUTH-02 · 로그인 / 로그아웃

- Firebase Auth 기반, 자동 로그인 (토큰 유지)
- 로그아웃 시 Zustand 스토어 초기화

### F-AUTH-03 · 온보딩 플로우

- 최초 가입 시에만 표시
- 스텝 1: 닉네임 설정
- 스텝 2: **달료 말투 선택** → **F-I18N-01** 연결
- 스텝 3: 달료 알 증정 연출 → **F-CHAR-01** 연결
- 스텝 4: 앱 권한 요청 (위치, 카메라, 알림)

---

## RUN — 달리기 코어

### F-RUN-01 · 달리기 시작 / 정지

- 시작 버튼: `t('run.start')` → 사투리 적용
- 정지 버튼: `t('run.stop')` → 사투리 적용
- 시작 시 GPS 트래킹 시작, 백그라운드 모드 지원
- 정지 시 운동 결과 화면으로 이동

### F-RUN-02 · 실시간 GPS 트래킹

- 1초 간격 위치 수집
- 실시간 표시 항목: 현재 속도(km/h), 현재 페이스(min/km), 경과 시간, 누적 거리(km)
- 달리기 중 달료 캐릭터 모션 표시 (**F-CHAR-03** 연동)
- 속도 구간:
  - `~6 km/h` → 느릿느릿 모션
  - `7~10 km/h` → 달려달려 모션
  - `11+ km/h` → 질주본능 모션

### F-RUN-03 · 운동 기록 저장

- Firestore `runs/{runId}` 저장
- `users/{uid}.totalKm` 업데이트
- **F-CHAR-04** (EXP 적립) 트리거
- **F-CAM-01** (카메라 필터 진입) 버튼 노출

```ts
// runs/{runId}
{
  runId: string
  uid: string
  startAt: Timestamp
  endAt: Timestamp
  durationSec: number
  distanceKm: number
  avgPaceSecPerKm: number
  avgSpeedKmh: number
  avgHeartRate: number | null
  route: GeoPoint[]
  expEarned: number
  createdAt: Timestamp
}
```

### F-RUN-04 · 운동 결과 화면

- 표시 항목: 총 거리, 평균 페이스, 소요 시간, 획득 EXP
- 달료 완주 리액션 대사 → `t('run.complete')` 사투리 적용
- 버튼: "달료랑 사진 찍기" → **F-CAM-01**, "피드에 올리기" → **F-FEED-01**

---

## CHAR — 캐릭터 시스템

### F-CHAR-01 · 알 지급 (온보딩)

- 가입 시 기본 캐릭터 풀에서 랜덤 타입 배정
- 캐릭터 타입은 부화 전까지 비공개
- 첫 달리기 완료 시 **F-CHAR-02** 트리거

```ts
// users/{uid}/character
{
  stage: 'egg' | 'sprout' | 'baby' | 'runner' | 'champion' | 'stone'
  characterType: string
  totalExp: number
  expToNextStage: number
  lastActiveAt: Timestamp
  isFrozen: boolean
}
```

### F-CHAR-02 · 부화 연출

- 첫 달리기 완료 후 알 깨지는 애니메이션 (Lottie)
- 캐릭터 공개, 이름 입력 (선택)

### F-CHAR-03 · 속도 연동 모션

- 실시간 속도에 따라 3단계 모션 전환
- 정지 시 숨 고르기 모션

### F-CHAR-04 · EXP 적립 및 성장 처리

**EXP 공식:**
```
획득 EXP = 달린 거리(km) × 10 × 아이템 배율 × 연속 달리기 보너스
```

**성장 단계:**

| 단계 | 누적 km | 해금 콘텐츠 |
|------|---------|------------|
| 🐣 새싹 | 10km | 기본 모션 |
| 🐥 아기 | 50km | 외형 변화, 마이룸 아이템 1종 |
| 🏃 러너 | 200km | 특수 모션, 필터 이펙트 강화 |
| ⚡ 챔피언 | 500km | 희귀 스킨, 최고급 필터 이펙트 |

- 단계 상승 시 대사 → `t('char.levelUp')` 사투리 적용

### F-CHAR-05 · 돌 변신 (방치 페널티)

- Firebase Functions 스케줄러 (매일 자정) 로 경과일 체크
- 모든 알림 텍스트 → `t('char.stoneWarningN')` 사투리 적용

| 일수 | 액션 | i18n 키 |
|------|------|---------|
| 3일 | 앱 진입 시 경고 배너 | `char.stoneWarning3` |
| 5일 | 캐릭터 색상 회색 전환 | `char.stoneWarning5` |
| 7일 | 완전 돌 변신 | `char.stoneFull` |
| 복구 | 달리기 완료 시 해동 | `char.stoneThaw` |

---

## FEED — 오운완 피드 / 소셜

### F-FEED-01 · 오운완 포스트 작성

- 자동 첨부: 거리, 페이스, 시간, 심박수, GPS 경로 썸네일
- 선택 첨부: 카메라 필터 사진
- 기본 해시태그: `#오운완 #달료런` + 사투리별 지역 태그 자동 추가
  - 경상도 → `#경상도달료런`
  - 전라도 → `#전라도달료런`
  - 충청도 → `#충청도달료런`
  - 제주도 → `#제주달료런`

```ts
// posts/{postId}
{
  postId: string
  uid: string
  runId: string
  text: string
  imageUrl: string | null
  distanceKm: number
  avgPaceSecPerKm: number
  durationSec: number
  avgHeartRate: number | null
  routeThumbUrl: string
  hashtags: string[]
  likeCount: number
  commentCount: number
  visibility: 'public' | 'followers'
  dialect: string             // 작성자의 사투리 설정 (표시용)
  createdAt: Timestamp
}
```

### F-FEED-02 · 피드 타임라인

- 팔로잉 유저 포스트 + 추천 포스트 혼합 노출
- 무한 스크롤 (Firestore 페이지네이션)

### F-FEED-03 · 좋아요 / 댓글

- 좋아요: 토글, 실시간 카운트
- 댓글: 텍스트 입력, 대댓글 1depth
- 좋아요 / 댓글 시 작성자에게 푸시 알림 (**F-NOTIF-01**)

### F-FEED-04 · 팔로우 / 언팔로우

- Firestore `follows/{uid}__{targetUid}` 컬렉션으로 관리
- 팔로우 시 상대방에게 푸시 알림

---

## CAM — 카메라 필터

### F-CAM-01 · 달료 카메라 필터

- react-native-vision-camera 기반
- 오버레이 구성:
  - 현재 달료 캐릭터 (성장 단계 반영)
  - 운동 데이터 뱃지: `오늘 {distanceKm}km · {pace}/km · 심박 {hr}bpm`
  - **사투리 문구** (선택 토글): `t('cam.filterText')` → 예: `"달렸다 아이가!"`
  - 달료 워터마크 (우하단, 제거 불가)
- 성장 단계별 이펙트:
  - 새싹~아기: 기본 오버레이
  - 러너: 바람선 이펙트
  - 챔피언: 파티클 이펙트

### F-CAM-02 · 외부 공유

- 인스타그램, 카카오스토리, 기본 공유 시트
- `react-native-share` 사용
- 달료 워터마크 유지 (제거 불가)

---

## INFL — 인플루언서 시스템

### F-INFL-01 · 인플루언서 등급 자동 부여

- Firebase Functions 매일 자정 팔로워 수 기준 등급 계산
- 등급 상승 알림 → `t('infl.tierUp')` 사투리 적용

| 등급 | 팔로워 기준 |
|------|------------|
| `none` | ~999 |
| `nano` | 1,000~9,999 |
| `micro` | 10,000~99,999 |
| `macro` | 100,000~999,999 |
| `mega` | 1,000,000+ |

### F-INFL-02 · 인플루언서 대시보드

- `nano` 이상 유저에게 노출
- 표시: 팔로워 추이 차트, 포스트 조회수·좋아요·공유 통계

### F-INFL-03 · 브랜드 매칭 (2단계)

> MVP 제외 — 2단계에서 구현

---

## I18N — 사투리 / 지역화 시스템

### F-I18N-01 · 사투리 설정

- `i18next` + `react-i18next` 기반
- 지원 로케일: `ko-std`, `ko-gyeong`, `ko-jeon`, `ko-chung`, `ko-jeju`
- 설정 저장: Firestore `users/{uid}.dialect` + AsyncStorage (오프라인 대응)
- 설정 위치: 온보딩 2단계 + 설정 > 달료 말투

```ts
// Zustand dialectStore
{
  dialect: DialectCode
  setDialect: (code: DialectCode) => void
}
```

### F-I18N-02 · 번역 리소스 파일 구조

```
src/
  locales/
    ko-std.json       // 표준어 (기본)
    ko-gyeong.json    // 경상도
    ko-jeon.json      // 전라도
    ko-chung.json     // 충청도
    ko-jeju.json      // 제주도
```

### F-I18N-03 · 번역 키 목록 및 문구

모든 사투리 파일은 아래 키를 동일하게 가져야 함.

```jsonc
// ko-std.json (표준어 — 기준 파일)
{
  "run": {
    "start": "달료!",
    "stop": "멈쵸!",
    "begin": "달리기 시작!",
    "complete": "완료! 잘 달렸어요 🎉",
    "distance": "{{km}}km 달렸어요!",
    "pace": "평균 페이스 {{pace}}/km"
  },
  "char": {
    "levelUp": "달료가 성장했어요! 🎉",
    "stoneWarning3": "달료가 뻣뻣해졌어요... 빨리 달려주세요!",
    "stoneWarning5": "달료 몸이 회색이 되고 있어요…",
    "stoneFull": "달료가 돌이 됐어요 🪨 오늘 달리면 해동돼요!",
    "stoneThaw": "달료가 녹고 있어요! 🔥",
    "hatch": "달료가 태어났어요!"
  },
  "cam": {
    "filterText": "오늘도 달료런! 🏃",
    "filterComplete": "달렸어요!"
  },
  "infl": {
    "tierUp": "축하해요! {{tier}} 인플루언서가 됐어요 🏅"
  },
  "notif": {
    "follow": "{{name}}님이 팔로우했어요",
    "like": "{{name}}님이 좋아요를 눌렀어요",
    "comment": "{{name}}: {{preview}}"
  },
  "feed": {
    "hashtagRegional": ""
  },
  "settings": {
    "dialectTitle": "달료 말투",
    "dialectDesc": "달료가 어떤 말투로 말할까요?",
    "dialects": {
      "ko-std": "표준어",
      "ko-gyeong": "경상도",
      "ko-jeon": "전라도",
      "ko-chung": "충청도",
      "ko-jeju": "제주도"
    }
  }
}
```

```jsonc
// ko-gyeong.json (경상도)
{
  "run": {
    "start": "달려뿌라!",
    "stop": "서뿌라!",
    "begin": "달리기 시작했다 아이가!",
    "complete": "다 달렸다 아이가! 고생했다! 🎉",
    "distance": "{{km}}km 달렸다 아이가!",
    "pace": "평균 페이스 {{pace}}/km"
  },
  "char": {
    "levelUp": "달료가 컸다 아이가! 🎉",
    "stoneWarning3": "달료가 굳어뿌고 있다 아이가, 빨리 달려라!",
    "stoneWarning5": "달료 몸이 회색 됐다 아이가…",
    "stoneFull": "달료가 돌 됐다 아이가! 🪨 오늘 달리면 녹는다!",
    "stoneThaw": "달료 녹고 있다 아이가! 🔥",
    "hatch": "달료가 태어났다 아이가!"
  },
  "cam": {
    "filterText": "오늘도 달료런! 아이가 🏃",
    "filterComplete": "달렸다 아이가!"
  },
  "infl": {
    "tierUp": "축하한다 아이가! {{tier}} 인플루언서 됐다! 🏅"
  },
  "notif": {
    "follow": "{{name}}님이 팔로우했다 아이가",
    "like": "{{name}}님이 좋아요 눌렀다 아이가",
    "comment": "{{name}}: {{preview}}"
  },
  "feed": {
    "hashtagRegional": "#경상도달료런"
  },
  "settings": {
    "dialectTitle": "달료 말투",
    "dialectDesc": "달료가 어떤 말투로 말할끼고?",
    "dialects": {
      "ko-std": "표준어",
      "ko-gyeong": "경상도",
      "ko-jeon": "전라도",
      "ko-chung": "충청도",
      "ko-jeju": "제주도"
    }
  }
}
```

```jsonc
// ko-jeon.json (전라도)
{
  "run": {
    "start": "달려부러!",
    "stop": "섰어부러!",
    "begin": "달리기 시작혔당께!",
    "complete": "다 달렸당께! 수고혔어! 🎉",
    "distance": "{{km}}km 달렸당께!",
    "pace": "평균 페이스 {{pace}}/km"
  },
  "char": {
    "levelUp": "달료가 컸당께! 🎉",
    "stoneWarning3": "달료가 굳어부렸당께, 빨리 달려!",
    "stoneWarning5": "달료 몸이 회색 돼부렸당께…",
    "stoneFull": "달료가 돌 돼부렸당께! 🪨 오늘 달리면 녹아!",
    "stoneThaw": "달료 녹고 있당께! 🔥",
    "hatch": "달료가 태어났당께!"
  },
  "cam": {
    "filterText": "오늘도 달료런당께! 🏃",
    "filterComplete": "달렸당께!"
  },
  "infl": {
    "tierUp": "축하혀! {{tier}} 인플루언서 됐당께! 🏅"
  },
  "notif": {
    "follow": "{{name}}님이 팔로우혔당께",
    "like": "{{name}}님이 좋아요 눌렀당께",
    "comment": "{{name}}: {{preview}}"
  },
  "feed": {
    "hashtagRegional": "#전라도달료런"
  },
  "settings": {
    "dialectTitle": "달료 말투",
    "dialectDesc": "달료가 어떤 말투로 말할랑가?",
    "dialects": {
      "ko-std": "표준어",
      "ko-gyeong": "경상도",
      "ko-jeon": "전라도",
      "ko-chung": "충청도",
      "ko-jeju": "제주도"
    }
  }
}
```

```jsonc
// ko-chung.json (충청도)
{
  "run": {
    "start": "달려야쥐!",
    "stop": "섰쥐뭐!",
    "begin": "달리기 시작했슈!",
    "complete": "다 달렸슈! 수고했어유! 🎉",
    "distance": "{{km}}km 달렸슈!",
    "pace": "평균 페이스 {{pace}}/km"
  },
  "char": {
    "levelUp": "달료 컸슈! 🎉",
    "stoneWarning3": "달료가 굳어가고 있슈, 빨리 달려유~",
    "stoneWarning5": "달료 몸이 회색 됐슈…",
    "stoneFull": "달료가 돌이 됐슈! 🪨 오늘 달리면 녹아유!",
    "stoneThaw": "달료 녹고 있슈! 🔥",
    "hatch": "달료가 태어났슈!"
  },
  "cam": {
    "filterText": "오늘도 달료런이슈! 🏃",
    "filterComplete": "달렸슈!"
  },
  "infl": {
    "tierUp": "축하혀유! {{tier}} 인플루언서 됐슈! 🏅"
  },
  "notif": {
    "follow": "{{name}}님이 팔로우했슈",
    "like": "{{name}}님이 좋아요 눌렀슈",
    "comment": "{{name}}: {{preview}}"
  },
  "feed": {
    "hashtagRegional": "#충청도달료런"
  },
  "settings": {
    "dialectTitle": "달료 말투",
    "dialectDesc": "달료가 어떤 말투로 말할까유?",
    "dialects": {
      "ko-std": "표준어",
      "ko-gyeong": "경상도",
      "ko-jeon": "전라도",
      "ko-chung": "충청도",
      "ko-jeju": "제주도"
    }
  }
}
```

```jsonc
// ko-jeju.json (제주도)
{
  "run": {
    "start": "달려수다!",
    "stop": "섰수다!",
    "begin": "달리기 시작했수다!",
    "complete": "다 달렸수다! 고생했수다! 🎉",
    "distance": "{{km}}km 달렸수다!",
    "pace": "평균 페이스 {{pace}}/km"
  },
  "char": {
    "levelUp": "달료 컸수다! 🎉",
    "stoneWarning3": "달료가 굳어가고 있수다, 빨리 달려봅서!",
    "stoneWarning5": "달료 몸이 회색 됐수다…",
    "stoneFull": "달료가 돌 됐수다! 🪨 오늘 달리민 녹아수다!",
    "stoneThaw": "달료 녹아가고 있수다! 🔥",
    "hatch": "달료가 태어났수다!"
  },
  "cam": {
    "filterText": "오늘도 달료런이우다! 🏃",
    "filterComplete": "달렸수다!"
  },
  "infl": {
    "tierUp": "축하헴수다! {{tier}} 인플루언서 됐수다! 🏅"
  },
  "notif": {
    "follow": "{{name}}님이 팔로우했수다",
    "like": "{{name}}님이 좋아요 눌렀수다",
    "comment": "{{name}}: {{preview}}"
  },
  "feed": {
    "hashtagRegional": "#제주달료런"
  },
  "settings": {
    "dialectTitle": "달료 말투",
    "dialectDesc": "달료가 어떤 말투로 말할까마씸?",
    "dialects": {
      "ko-std": "표준어",
      "ko-gyeong": "경상도",
      "ko-jeon": "전라도",
      "ko-chung": "충청도",
      "ko-jeju": "제주도"
    }
  }
}
```

### F-I18N-04 · 사투리 적용 컴포넌트 규칙

- 모든 사용자 노출 문자열은 하드코딩 금지, 반드시 `t('key')` 사용
- 변수 삽입: `t('run.distance', { km: 10.2 })`
- 사투리 변경 즉시 앱 전체 반영 (앱 재시작 불필요)
- 카메라 필터 오버레이 문구도 `t()` 기반으로 렌더링

```tsx
// 사용 예시
import { useTranslation } from 'react-i18next'

const RunButton = () => {
  const { t } = useTranslation()
  return <Button title={t('run.start')} onPress={handleStart} />
}
```

---

## NOTIF — 알림

### F-NOTIF-01 · 푸시 알림

Firebase Cloud Messaging(FCM) 기반. 모든 알림 텍스트는 수신자의 `dialect` 설정 기준으로 서버에서 렌더링.

| 트리거 | i18n 키 |
|--------|---------|
| 팔로우 | `notif.follow` |
| 좋아요 | `notif.like` |
| 댓글 | `notif.comment` |
| 캐릭터 성장 | `char.levelUp` |
| 돌 경고 3일 | `char.stoneWarning3` |
| 돌 경고 5일 | `char.stoneWarning5` |
| 돌 변신 7일 | `char.stoneFull` |
| 인플루언서 등급 상승 | `infl.tierUp` |

> Firebase Functions에서 `users/{uid}.dialect` 값을 읽어 해당 로케일 파일에서 문구 조합 후 FCM 발송

---

## PROFILE — 프로필 / 설정

### F-PROFILE-01 · 내 프로필

- 닉네임, 프로필 사진, 달료 캐릭터, 팔로워/팔로잉, 인플루언서 등급 배지
- 누적 통계: 총 달린 거리, 달리기 횟수, 최장 거리, 최고 페이스
- 내 포스트 그리드

### F-PROFILE-02 · 설정

- 프로필 편집 (닉네임, 사진)
- **달료 말투 변경** → **F-I18N-01** 연결
- 알림 설정 (항목별 on/off)
- 개인정보 처리방침, 서비스 이용약관
- 로그아웃 / 회원 탈퇴

---

## 데이터 구조 요약 (Firestore)

```
users/{uid}                         dialect 필드 포함
runs/{runId}
posts/{postId}                      dialect 필드 포함 (작성자 방언 기록)
posts/{postId}/comments/{commentId}
posts/{postId}/likes/{uid}
follows/{uid}__{targetUid}
notifications/{notifId}
```

---

## 비기능 요구사항

| 항목 | 기준 |
|------|------|
| GPS 정확도 | 오차 10m 이내 |
| 배터리 | 백그라운드 GPS 저전력 모드 지원 |
| 오프라인 | 달리기 데이터 로컬 임시 저장 후 네트워크 복구 시 sync |
| 이미지 업로드 | Firebase Storage, 최대 10MB / 포스트당 1장 |
| 푸시 알림 | FCM, 포그라운드 / 백그라운드 / 종료 상태 모두 수신 |
| 사투리 전환 | 앱 재시작 없이 즉시 반영 |
| 최소 지원 버전 | iOS 14+ / Android 10+ |

---

## 구현 우선순위

```
Phase 1 (Week 1~2):  F-AUTH-01, F-AUTH-02, F-AUTH-03
Phase 2 (Week 3~4):  F-RUN-01, F-RUN-02, F-RUN-03, F-RUN-04
Phase 3 (Week 5~6):  F-CHAR-01, F-CHAR-02, F-CHAR-03, F-CHAR-04, F-CHAR-05
Phase 4 (Week 7~8):  F-I18N-01, F-I18N-02, F-I18N-03, F-I18N-04
Phase 5 (Week 9~10): F-FEED-01, F-FEED-02, F-FEED-03, F-FEED-04
Phase 6 (Week 11):   F-CAM-01, F-CAM-02
Phase 7 (Week 12):   F-INFL-01, F-INFL-02, F-NOTIF-01, F-PROFILE-01, F-PROFILE-02
```

---

*REQUIREMENTS.md v0.2 · 달료 MVP · 2025년 4월*
