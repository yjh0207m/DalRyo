# Firestore 접근 분석 (규칙 변경 전 기록)

개발 DB: dalryo-dev / (default) / STANDARD. 사용자 문서는 비공개 PII 포함.

| 경로 | 읽기 | 쓰기 | 주요 제약 |
|---|---|---|---|
| users/uid | 본인 문서 구독/get | 온보딩 create, 프로필/FCM update | 키/몸무게/전화/이메일은 타인에게 공개하지 않음; 성장/카운터 서버 소유 |
| users/uid/character/uid | 본인 구독 | 최초 egg create | 이후 성장/이름 변경은 서버 트랜잭션 |
| users/uid/notifications/id | 본인 최신순20, is_read=false limit1 | is_read bool update | 알림 생성은 서버만 |
| users/uid/feed/id | 본인 최신순20 (기존) | 서버만 | 기존 실험 피드, 새 UI는 canonical posts 참조 |
| runs/id | uid==본인, started_at 범위, 최신순 | 본인 create | EXP=0 시작, 성장 보상 서버 처리 |
| posts/id | public 최신순, 본인 uid 최신순, 단일 get | socialAction 서버만 | followers는 follows 관계 확인; private는 작성자만 |
| posts/id/likes/uid | 보이는 부모 게시물의 응원 상태 | 서버만 | set-liked 멱등 요청 + post count 원자 갱신 |
| posts/id/comments/id | 보이는 부모 게시물 최신순 | 서버만 | 답글은 같은 게시물 부모 참조, 삭제는 tombstone |
| follows/follower_following | 로그인 사용자의 관계 조회 | 서버만 | 본인→타인, 양쪽 카운터 서버 트랜잭션 |
| bookmarks/uid_post | 본인 uid만 | 서버만 | 본인 보관함, 대상 읽기 가능 여부 서버 확인 |
| together_rooms/id/members/uid | 로그인 사용자 | 본인 활동 상태 | 호스트 상태와 가입/시작 전환 검증 필요 |
| parks/id/courses/id | 로그인 사용자 | 관리 서버만 | 읽기 전용 코스 데이터 |

소셜 공개 프로필·검색·랭킹은 callable이 users에서 **허용된 공개 필드만** 추출한다.
클라이언트에 users 전체 조회 권한을 주지 않는다.
posts soft-delete는 본문/사진을 지우고 visibility=private로 전환한다.
기존 규칙은 followers 글을 모든 로그인 사용자에게 허용하고 소셜 직접 쓰기를 허용해 수정 필요.

변경 규칙은 프로토타입이다. 에뮬레이터에서 본인/타인, public/followers/private,
컬렉션 쿼리, 알림 bool 이외 수정, 직접 카운터 변경, 잘못된 온보딩/달리기 입력을 검증한다.
