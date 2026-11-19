# frontend

Coetus의 사용자 화면과 PWA 관련 코드를 관리할 공간입니다.

## 개발 예정 범위

- 로그인 및 회원가입 화면
- 팀 생성, 초대 링크 참여 및 팀 관리 화면
- 개인 시간표와 활동 가능 시간 입력 UI
- 공통 공강 추천 결과와 회의 시간 투표 화면
- 회의 일정 확정 및 관리 화면
- 팀별 역할, 할 일, 마감일 및 진행 상황 관리 화면
- 모바일 반응형 디자인 및 PWA

## 현재 상태

화면 초안이 구현되어 있습니다. 백엔드 API가 아직 없어서 **임시 저장소와 예시 데이터**로 동작하며, 새로고침하면 예시 데이터로 돌아갑니다. PWA(설치, 오프라인 캐시)와 배포 설정은 아직 하지 않았습니다. 팀원 모집·공개 모집글·지원자 매칭 화면은 개발 범위에서 제외합니다.

화면 목록, 주소, 규칙, 데이터 모델은 [`docs/screens.md`](../docs/screens.md)에 정리되어 있습니다.

## 기술 스택

React 19, TypeScript, Vite, Tailwind CSS 4, react-router-dom 7(HashRouter), 테스트는 Vitest를 사용합니다. 배포 방식은 아직 정하지 않았습니다.

## 실행 방법

Node.js 22 이상이 필요합니다. `frontend/` 폴더에서 실행합니다.

```bash
npm install        # 처음 한 번
npm run dev        # 개발 서버 (코드를 고치면 바로 반영)
npm run build      # 타입 검사 + 배포용 파일 생성 (dist/)
npm test           # 테스트
npm run lint       # 린트
```

## 폴더 구조

```text
src/
├── App.tsx            화면 주소(라우트) 목록
├── index.css          디자인 규칙(색, 글꼴)을 Tailwind 테마로 정의
├── types.ts           공통 타입
├── components/
│   ├── ui/            버튼, 입력칸, 칩, 카드 등 공통 부품
│   └── layout/        화면 틀, 상단 바, 하단 탭 바
├── pages/             화면 (auth, account, teams, timetable, schedule, todos, errors)
├── lib/               공통 가능 시간 계산, 투표 판정, 표시 형식 (테스트 포함)
├── store/             앱 상태와 동작 (임시. API가 생기면 이곳을 API 호출로 교체)
└── mocks/seed.ts      예시 데이터
```

## 백엔드와 연결할 때

화면은 `src/store/index.ts`의 함수(`teamActions`, `scheduleActions`, `todoActions` 등)만 부릅니다. API가 정해지면 이 파일의 함수를 API 호출로 바꾸고, 화면 코드는 그대로 두는 것을 목표로 합니다. 판정 규칙(공통 가능 시간, 과반)은 `src/lib/`의 구현과 테스트를 기준으로 서버와 맞춰야 합니다.

예시 계정: 아이디 `jinwoo`, 비밀번호 `1234`, 비밀번호 찾기 질문의 답 `제주`.
