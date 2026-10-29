# 1:1 채팅 접근 구조 · 2026-10-29

기존 dalryo-dev (default), Standard, asia-northeast3를 사용한다. 기존 socialAction의 인증/프로필 검사를 거쳐 chatOpen/chatSend/chatRead/chatBlock을 처리한다. 새 공개 callable이나 사용자 문서 공개 읽기는 추가하지 않는다.

- conversations/{SHA256(sorted UID pair)}: members 2명, 공개 이름/사진만 담은 profiles, blocked_by, read_at, 최근 메시지 미리보기/시각/ID. members와 발신자는 서버가 결정한다.
- messages/{client generated ID}: sender_uid, text(공백 제거 후 1~2000자), 서버 created_at. 수정/삭제 불가. 같은 ID와 내용 재시도는 성공 반환, 타인/다른 내용 덮어쓰기는 거부한다.
- 읽음은 표시된 최신 메시지 ID가 서버 최신 ID와 같은 경우만 반영한다. 본인 read_at만 변경한다. 한쪽이 차단하면 양쪽 신규 전송을 막고, 본인 차단만 해제할 수 있다. 기존 내역은 유지한다.
- 인박스: members array-contains 현재 UID, updated_at desc, documentId desc, 50개 페이지. 메시지: created_at desc, documentId desc, 50개 페이지. 실시간 수신과 이전 페이지를 ID로 합친다.
- 클라이언트 쓰기는 전부 금지한다. room read는 members에 현재 UID가 포함될 때, message read는 존재하는 부모 room의 참여자일 때만 허용한다. 이메일·전화·FCM 토큰은 방에 복사하지 않는다.

검증 스크립트 scripts/test-chat.cjs: 미인증/제3자 읽기·쓰기·검색, 직접 방/메시지/읽음/멤버 위조, 기존 메시지 수정·삭제, 스키마 오염, 빈/과대/타입 오류, 발신자 위조, 재전송, 차단 우회, 읽음 경합, 페이지네이션을 테스트한다. 기존 사용자 권한·게시물·러닝 규칙은 유지한다. 클라이언트 쓰기를 거부하므로 create/update 검증 우회는 허용되지 않는다.

시작 범위는 텍스트 1:1 대화와 앱 내 새 메시지 표시다. 사진/음성 전송, 그룹 대화, 메시지 삭제, 푸시 알림 연결은 별도 후속 범위다. 규칙은 출시 전 추가 검토가 필요한 초안이며 테스트 결과는 해당 시나리오의 검증 범위다.
