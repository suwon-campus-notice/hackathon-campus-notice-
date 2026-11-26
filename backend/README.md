# backend

Coetus의 서비스 로직과 자체 REST API를 관리할 공간입니다. API는 별도 최상위 폴더 없이 이 폴더 내부에 둘 예정입니다.

## 개발 예정 범위

- 사용자 및 팀 관리
- 초대 링크를 통한 팀 초대 및 참여 처리
- 개인 시간표와 활동 가능 시간 데이터 처리
- 팀원 간 공통 공강 시간 계산 알고리즘
- 회의 시간 추천·투표 처리 및 일정 확정·관리
- 역할 분담, 할 일, 마감일 및 진행 상황 관리
- 사용자 인증 및 팀별 접근 권한 검증
- 데이터베이스 연동

Python FastAPI 기반 REST API와 PostgreSQL(Supabase) 연동을 계획하며, 배포는 Render를 검토합니다. 기술 스택과 인증 방식 등 세부 설계는 미확정입니다. 데이터베이스 설계 자료는 `database/`, API 명세는 `docs/`에서 관리할 예정입니다.

현재 서버·API 엔드포인트·외부 서비스 연결은 구현하지 않았습니다. 담당 업무 확정 후 하위 디렉터리와 개발 파일을 추가하며, 설치·실행 명령어는 환경 구성 후 작성합니다. 팀원 모집·공개 모집글·지원자 매칭은 개발 범위에서 제외합니다.

## 테스트 서버 (여러 기기에서 같은 데이터 보기)

정식 백엔드 전에, 프런트 화면을 여러 기기에서 함께 써 보기 위한 **최소 서버**입니다. `backend/app/main.py` 하나이며 다음만 합니다.

- `frontend/dist`(빌드한 화면)와 `/api`를 한 프로세스(6000 포트)로 서빙
- 앱 상태(사용자·팀·시간표·투표·회의·목표·할 일·계정)를 `backend/data/state.json` 한 문서로 보관 (Git 추적 제외)
- 동시 수정은 `version`으로 처리: `PUT /api/state`의 `base`가 현재 version과 다르면 409와 최신 문서를 돌려주고, 프런트가 최신 문서 위에 자기 변경을 다시 적용해 보냅니다

규칙(과반 판정, 시간표 겹침, 권한 등)은 프런트의 `src/store`가 그대로 담당하고, 서버는 문서를 보관·배포만 합니다. 정식 설계(PostgreSQL, 서버 측 인증, 비밀번호 해시)와는 별개이며, 이 테스트 서버는 비밀번호를 문서 안에 그대로 두므로 테스트 외 용도로 쓰면 안 됩니다.

```bash
cd frontend && npm install && npm run build      # 화면 빌드 (dist/)
cd ../backend && pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 6000
# 화면: http://localhost:6000/   API 문서: http://localhost:6000/api/docs
```

| 요청 | 설명 |
| --- | --- |
| `GET /api/health` | 동작 확인, 현재 version |
| `GET /api/state?since=<version>` | 문서 받기. version이 같으면 `unchanged` |
| `PUT /api/state` `{base, state}` | 문서 저장. base가 다르면 409 + 최신 문서 |
| `POST /api/reset` | 문서 비우기 → 다음 접속한 기기가 예시 데이터를 다시 올림 |

예시 계정은 `frontend/src/mocks/seed.ts`와 같습니다 (`jinwoo` / `1234`, `minsu` / `1234`).
