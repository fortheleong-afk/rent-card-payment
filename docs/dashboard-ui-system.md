# Divercity Pay — 사용자 대시보드 디자인 기준

적용일: 2026-11-19. 첫 적용 범위는 `/dashboard`이다.

## 적용 방식

- Astryx core / theme-neutral / CLI **0.7.16**, StyleX peer **0.19.0**.
- 공식 React 19 요구사항에 맞춰 react / react-dom **19.2.9**로 함께 업데이트했다.
- 실제 Astryx `Theme`, `LinkProvider`, `Button`, `Badge`를 사용한다. 링크 버튼은 Next.js Link로 렌더링되며, 페이지 이동과 클릭 행동을 구분한다.
- 기존 `getJourney`, `priorityApplication`, `tenantTask`, Supabase 조회, 임시 저장·제출 복구 안내를 재사용한다. DB 정책, SQL, 결제/송금 RPC는 변경하지 않는다.
- `components/ui/DashboardTheme.tsx`가 대시보드에서만 테마를 제공한다. 다른 화면까지 일괄적으로 바꾸는 글로벌 reset은 추가하지 않는다. 기존 앱 reset 위에 Astryx의 컴포넌트 CSS를 사용한다.
- CLI 초기화 문서는 `docs/astryx-dashboard-reference.md`에만 저장한다. 전역 에이전트 설정과 기존 AGENTS.md를 변경하지 않는다.

## 공통 규격

| 항목 | 기준 |
|---|---|
| 본문·헤더 최대 너비 | 68rem, 같은 좌우 기준선 |
| 좌우 여백 | 데스크톱 2rem / 모바일 1rem |
| 기본 여백 단위 | Astryx 4px 단위 spacing tokens |
| 섹션 간격 | 32px / 모바일 24px |
| 카드 안쪽 간격 | 32px / 모바일 20px |
| 카드 헤더 간격 | 24px / 모바일 20px |
| 관련 텍스트 간격 | 8–12px |
| 버튼 최소 높이 | 44px, 큰 버튼 48px |
| 페이지 제목 | 28–36px, rem 기반 clamp |
| 섹션 제목 / 본문 | 20–24px / 15–16px |
| 보조 정보 | 13px, 충분한 대비 유지 |
| 카드 / 버튼 모서리 | 12px / 8px |

브랜드 색과 폰트는 `components/ui/divercity-theme.ts`에서 관리한다. 화면별 CSS에서 같은 색을 반복 정의하지 않는다. 현재 브랜드 파랑과 Manrope / Noto Sans KR을 유지한다.

## 읽기 순서와 상태

1. 화면 제목과 새로고침
2. 테스트 모드 안내 및 기존 알림·프로필 링크
3. 제출 복구가 필요한 임시 신청 또는 우선 확인할 신청
4. 현재 상태, 다음 할 일, 처리 단계, 하나의 주요 행동
5. 신청 목록·필터와 전체 내역
6. 도움말과 계정 링크

현재 상태와 다음 행동은 넓은 화면에서 두 열, 좁은 화면에서는 DOM 순서대로 한 열로 표시한다. 필터는 좁은 화면에서 두 열로 줄바꿈하여 숨겨진 가로 스크롤 없이 조작한다. 새로고침 중에는 Astryx의 로딩 상태와 기존 중복 요청 가드를 함께 사용한다.

## 접근성과 Modern Web Guidance

- `responsive-design` 가이드: rem 제한과 viewport 값을 함께 쓰는 clamp 제목 크기, 좁은 화면 한 열 전환, `dvh` 높이로 모바일 브라우저 변화 대응.
- 기본 DOM 순서와 링크 의미 유지. 현재 페이지 aria-current, 필터 aria-pressed, 상태 변경 안내, 키보드 focus-visible 및 본문 건너뛰기 링크를 제공한다.
- 버튼 클릭 영역 44px 이상. 카운트는 Badge, 신청 상태는 기존 문구와 상태 표시를 유지한다.
- 화면 등장 때문에 콘텐츠를 숨기는 애니메이션을 추가하지 않는다.

## 재검증 명령

- `npm run theme:build`: 테마 원본에서 CSS/JS/타입을 재생성
- `npm run theme:check`: 생성 파일과 테마 원본 일치 여부 확인
- `npm run lint`
- `npm run test:core`
- `npm run build`
- `npm run astryx -- doctor --built .next`

테마 빌드 결과도 GitHub에 함께 저장하여 배포 시 별도 테마 생성 단계에 의존하지 않는다. 후속 화면은 이 테마를 재사용하되, 신청 처리와 관리자 기능을 중복 구현하지 않는다.

## 검증 범위

빌드, 타입 검사, 린트, 핵심 회귀 검사 및 Astryx doctor 결과를 확인한다. 브라우저에서는 기존 로그인 세션의 신청 표시, 필터의 빈 상태와 복귀, 새로고침, 신청 상세 이동, 모바일 줄바꿈을 확인한다. 결제·송금 테스트 모드는 유지하며 새 금융 거래는 실행하지 않는다.
