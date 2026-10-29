# 공원 데이터 접근 점검 — 2026-10-28

- 기존 dalryo-dev / (default) / STANDARD 사용. 사용자 문서 PII 조회 범위 유지.
- parks/{id}: 로그인 읽기, 관리 서버만 쓰기. 공개 OSM 공원 식별자/이름/중심좌표/주소/출처. 코스는 실제 등록 데이터만 읽는다.
- parks/{id}/courses/{id}: distance_km 정렬 최대 30개. 등록되지 않은 경로는 생성하지 않는다.
- park_search_cache/{grid}: 서버 전용. 0.01도 격자 중심 주변 공원, 24시간 캐시. 외부 공급자에는 UID나 정확한 사용자 위치를 보내지 않는다.
- users/{uid}/park_search/rate: 서버 전용, 검색 간격 30초. 외부 공급자 실패 시 7일 이내 캐시만 사용하고 오래된 정보임을 응답한다.
- parks/{id}/weeks/{KST Monday}/runners/{uid}: 서버 집계/서버 callable 조회. 공개 이름·사진·주간 거리·횟수만 저장. 원본 runs와 users는 소유자 전용을 유지한다.
- runs: park_id는 실제 공원 참조 또는 null. course_id는 선택 시 해당 공원 하위의 실제 코스 참조. 메타데이터는 작성 이후 변경 금지.
- onRunCreate가 기존 growth_applied 트랜잭션 안에서 주간 랭킹을 한 번만 적립한다. 비정상 속도와 거리 0은 랭킹에서 제외.

검증: 잘못된/없는 공원·다른 공원의 코스 참조, 직접 랭킹 쓰기, 비공개 사용자/러닝 조회, 이벤트 재전달 집계 중복을 로컬 에뮬레이터에서 검사한다.
