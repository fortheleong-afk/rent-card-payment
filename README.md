# Divercity Pay

외국인 임차인을 위한 월세 카드결제 서비스의 **테스트 시제품**입니다. 실제 카드 결제와 계좌 송금 기능은 연결되어 있지 않습니다.

## 사용 흐름

1. 홈페이지 `/`의 단계별 신청 화면은 체험용입니다. 입력값과 파일은 서버에 전송하거나 저장하지 않습니다.
2. 회원가입·로그인 후 대시보드 `/dashboard`에서 **월세 신청하기**를 누르면 실제 테스트 신청 페이지 `/applications/new`가 열립니다.
3. 계약서 → 월세·계약 정보 → 임대인 입금 계좌 → 최종 확인 순서로 진행합니다. 필수 정보가 빠지면 다음 단계로 넘어갈 수 없습니다.
4. 마지막 제출 시 계약서가 비공개 Supabase Storage에 업로드됩니다. 이어서 Supabase 함수 하나가 신청·초기 상태 이력·알림을 한 데이터베이스 트랜잭션에서 저장합니다.
5. 신청 내역은 본인과 관리자만 조회할 수 있습니다. 관리자 심사와 사용자 취소도 별도 RPC에서 상태·이력·알림을 함께 저장합니다.

**테스트 모드:** 신청은 심사 업무를 시험하기 위한 데이터입니다. 결제·송금 API 호출, 카드 정보 수집, 자동 이체는 없습니다. 이용료는 아직 정해지지 않아 화면에 “To be confirmed”라고 표시하고 데이터베이스에는 0으로 저장합니다.

## 개발 환경

- Next.js 14 + TypeScript
- Supabase Auth, Postgres, private Storage
- GitHub `fortheleong-afk/rent-card-payment` → Vercel Production 자동 배포

## 로컬 실행

1. Node.js LTS를 설치하고 이 폴더에서 `npm install`을 실행합니다.
2. `.env.example`을 `.env.local`로 복사합니다. Supabase 대시보드의 Project URL과 **publishable key**를 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`에 넣습니다. 비밀 키나 service role 키는 브라우저 환경변수에 넣지 않습니다.
3. `npm run dev`를 실행하고 `http://localhost:3000`을 엽니다.
4. `npm run build`로 배포 빌드를 확인합니다.

`.env.local`은 Git에 올리지 않습니다. Vercel에서도 같은 두 환경변수를 프로젝트 설정에 별도로 등록해야 합니다.

## 데이터베이스 변경

새 Supabase 프로젝트라면 `supabase/schema.sql`을 먼저 실행한 뒤 `supabase/migrations/001_application_workflow.sql`부터 `005_orphan_contract_cleanup.sql`까지 순서대로 SQL Editor에서 실행합니다. 기존 프로젝트에는 아직 적용되지 않은 마이그레이션만 실행합니다. `004`는 신청 제출 RPC를 만들고, 신청·이력·알림의 직접 쓰기 정책을 제거합니다. 따라서 **웹 코드 배포 전에** 실행해야 합니다.

저장 중 응답이 끊기면 신청 페이지는 같은 제출 ID와 계약서 경로로 다시 시도합니다. 이 방식은 중복 신청을 막지만, 파일 업로드 직후 브라우저를 닫으면 참조되지 않는 파일이 남을 수 있습니다. 관리자는 `/admin/storage-cleanup`에서 7일 이상 된 미연결 파일을 필요할 때만 최대 50개씩 조회하고, 확인 후 Supabase Storage API로 삭제할 수 있습니다. 자동 예약 작업이나 주기적 조회는 없습니다. 신청에 연결된 계약서는 취소 상태라도 삭제되지 않도록 Storage 정책에서 재검증합니다.
