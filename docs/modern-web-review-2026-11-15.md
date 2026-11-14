# Modern Web Guidance 점검 — 2026-11-15

대상: Divercity Pay, 기존 main `5d512d744de7200aed0171a926077e5786f7609f`.
실제 결제·송금은 테스트 모드 유지. DB 권한과 금융사 연동은 변경하지 않음.

## 기준과 범위

GoogleChrome/modern-web-guidance-src의 배포용 Modern Web Guidance를 임시 npm 캐시에서 실행했다. 프로젝트 의존성이나 전역 에이전트 설정에 가이드를 설치하지 않았다.

- 공식 가이드 스냅샷: GoogleChrome/modern-web-guidance main `4dd968349e54ca45a05dd5c818fb035c9054b022`.
- CLI `legacy-scan . --json`: 변경 전후 0건. 33개 가이드 / 35개 정적 규칙으로 전체 가이드의 약 20%만 검사하므로 기능·보안 통과 인증이 아니다.
- `forms`, `autofill-sign-in-form`, `autofill-sign-up-form`, `accessible-error-announcement`를 읽고 네이티브 폼, 자동완성, 상호작용 후 오류 표시와 포커스 관리에 적용했다.
- 홈, 인증, 프로필, 알림, 대시보드, 신청·상세, 관리자, 파일 처리 코드를 함께 검토했다. 재구현하거나 별도 데모/권한 체계를 추가하지 않았다.

## 수정 내용

1. 로그인·회원가입: 실제 form/submit, Enter 제출, required, 안정적인 id/name, username/current-password/new-password 자동완성, 비밀번호 표시 토글, 국제 연락처 지원, 중복 요청 방지, 연결 실패 복구 안내.
2. 공통 입력: 최초 방문부터 오류를 표시하지 않음. 제출/상호작용 후 aria-invalid와 오류 설명 연결. 필수 입력 누락 시 네이티브 포커스 이동. 16px 이상 입력 글자와 48px 입력 높이.
3. 프로필: 영어 사용자 화면, 읽기 전용 이메일, 로딩·조회 오류·재시도, 실제 갱신된 행 확인 후 성공 표시. DB 오류를 빈 프로필이나 성공으로 표시하지 않음.
4. 홈페이지 이름: 프로필에 저장한 이름을 조회해 오래된 Auth 메타데이터보다 우선 표시. 로그아웃 실패도 표시.
5. 알림: 로딩/오류/빈 상태 구분, 재시도, 최근 100건 제한. 성공적으로 읽은 알림 ID만 읽음 처리하여 조회 중 새로 온 알림까지 읽음 처리하지 않음.
6. 신청: 단계 전환 시 제목으로 포커스 이동, Enter로 다음 단계 진행, 최종 제출 동의 누락 시 체크박스 포커스. 실제 달력에 존재하지 않는 날짜도 거부.
7. 관리자 계약서: 미리보기 창의 opener 제거. 다운로드는 다운로드용 서명 URL을 별도 발급하여 cross-origin download 속성이 무시되는 문제 방지. 5분 만료 및 기존 비공개 Storage 정책 유지.
8. 복귀 URL: 브라우저가 정규화하는 개행/탭/제어문자와 역슬래시를 거부하고 URL origin을 다시 확인.
9. 페이지 오류/404 복구 화면, 공통 키보드 포커스, reduced-motion 스크롤, nosniff/no-referrer/프레임 삽입 차단 응답 헤더.
10. 의존성: Next.js 14.2.35 → 15.5.29, 대응 ESLint 설정, PostCSS 보안 패치. 기존 React 18 호환 범위를 유지하고 페이지 파라미터는 useParams로 변경. 잠금 파일 추가. 린트가 대화형 설치 없이 재실행 가능하도록 구성.

## 검증

- Next.js production build 통과.
- TypeScript 검사 및 ESLint 오류·경고 0건.
- `npm run test:core`: 같은 origin 복귀 주소, 국제 이름/전화번호, 달력 날짜/윤년, 필수 계약서, 월세 경계값, 계좌 형식, 대시보드 우선순위 회귀 검사 통과.
- 기존 신청 검증 및 14개 review/payment/payout 표시 시나리오 회귀 검사 통과.
- 로컬 모바일 390px: 회원가입/로그인 필수 입력, 오류 설명과 첫 필드 포커스, 가로 넘침 없음 확인.
- 비로그인 관리자 경로가 로그인 화면으로 이동하고 next=/admin 유지 확인.
- 런타임 의존성 `npm audit --omit=dev`: 공개 경고 0건. 개발 도구에는 minimatch 관련 moderate 경고 6건이 남아 있으며, 호환성을 깨는 강제 override로 숨기지 않았다.
- 배포 후 기존 로그인 세션으로 대시보드/상세/관리자/프로필/알림을 확인할 계획이며 최종 대화 응답에 실제 확인 결과를 기재한다.

## 남은 한계

- 물리적 휴대폰, iOS Safari/Firefox 및 실제 화면낭독기 검증은 별도 필요. 이번 휴대폰 검증은 브라우저 viewport 모사임.
- Lighthouse/실사용 Core Web Vitals 수치는 측정하지 않았으므로 성능 점수나 WCAG 인증을 주장하지 않음.
- 신규 계정 생성/비밀번호 재설정 메일 발송, 전체 승인·반려·취소 시나리오를 이번 작업에서 반복 실행하지 않음. 기존 테스트 이력과 테스트 모드 RPC를 유지했으며 실제 카드/송금 API는 추가하지 않음.
- 웹 가이드 점검으로 금융사 계약, KYC, 법률 검토, 운영 DB의 실시간 권한 검증이 대체되지는 않음.

## 출처

- https://github.com/GoogleChrome/modern-web-guidance-src
- https://github.com/GoogleChrome/modern-web-guidance
- https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
- https://nextjs.org/docs/app/guides/upgrading/version-15
