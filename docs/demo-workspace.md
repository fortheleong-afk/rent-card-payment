# Divercity Pay 시연 계정

- 전용 경로: /demo/dashboard, /demo/admin, /demo/apply
- 고정 Supabase Auth user ID는 lib/demo-account.ts에서 식별. user_metadata로 권한을 부여하지 않음.
- 실제 profiles.role은 tenant. is_admin()은 false. 운영 관리자 권한 없음.
- 시연 화면은 코드의 합성 샘플만 사용. 신청·계약·결제 DB 조회/변경 및 서명 링크 발급 없음.
- 기존 워크스페이스 경로로 진입하면 WorkspaceGate에서 시연 경로로 이동, 운영 화면 자식은 마운트하지 않음.
- 이 게이트는 화면 분리용. 실제 보안 경계는 기존 RLS·DB 역할이며 일반 사용자 권한을 확대하지 않음.
- 상태/사유/가상 알림은 탭별 sessionStorage에만 보관, 초기화 가능. 실제 개인정보를 입력하지 않음.
- 기존 홈페이지 ApplicationDemo를 재사용, 체험 제출은 DB에 전송되지 않음.
- 비밀번호는 공개 소스에 넣지 않음. 로컬 .env.demo.local은 gitignore 대상이며 별도로 전달.
- 계정은 받은편지함이 없는 예약 도메인의 가상 이메일. 이메일 복구용이 아님.
- 공유용 UI는 가상 자료 재현이며 운영 관리자 화면과 일부 배치·기능 범위가 다름.
