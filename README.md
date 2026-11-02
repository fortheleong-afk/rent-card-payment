# 집업페이 월세 카드결제 테스트 서비스

임차인이 월세를 카드로 결제하고, 임대인 계좌로 입금하는 서비스의 **프론트엔드 프로토타입**입니다.

## 현재 구현된 화면

- `/` : 모바일 중심 랜딩 페이지와 월세 결제 신청 4단계 데모
- `/login` : Supabase Auth 로그인 화면
- `/admin` : 관리자 거래 관리 대시보드와 심사 목록
- `supabase/schema.sql` : Supabase에 넣을 거래 신청 테이블 구조

## 중요한 테스트 모드 안전장치

현재는 실제 카드 승인, 계좌 이체, 금융사 API 호출이 전혀 없습니다. 모든 신청은 화면에서만 완료되는 데모입니다. 실제 연동 전에는 `NEXT_PUBLIC_TEST_MODE=true`를 유지하고, 서버 API에서도 이 값을 확인하는 이중 안전장치를 추가해야 합니다.

## 실행 방법

1. Node.js LTS를 설치합니다: https://nodejs.org
2. 이 폴더에서 터미널을 열고 `npm install`을 실행합니다.
3. `.env.example`을 복사해 `.env.local`을 만들고, Supabase 프로젝트의 URL과 publishable key를 입력합니다.
4. `npm run dev`를 실행한 다음 브라우저에서 `http://localhost:3000`을 엽니다.

## 다음 개발 순서

1. Supabase Auth 회원가입 연결
2. Storage에 계약서 업로드 연결 및 개인정보 접근 정책 설정
3. 관리자 권한(RLS)과 심사 상태 변경 API 추가
4. 금융사 계약 이후에만 별도 서버 모듈로 결제/송금 연동
