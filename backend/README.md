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

## 현재 상태

**1차(가입·로그인, 팀, 시간표, 공통 공강)와 2차(회의 투표·확정, 목표·할 일)가 구현되어 있습니다.** 팀원 모집·공개 모집글·지원자 매칭은 개발 범위에서 제외합니다.

- API 목록과 요청·응답 예시: [`docs/API_SPEC.md`](../docs/API_SPEC.md) (서버를 켜면 `/docs` 에서도 볼 수 있음)
- 구현: FastAPI + SQLAlchemy + SQLite. 서버 하나가 API(`api/...`)와 화면(`frontend/dist`)을 함께 제공합니다. 밖에서 열리는 포트가 6000번 하나뿐이라서입니다.
- DB 파일: `backend/data/coetus.db` (`~/work` 안이라 서버를 꺼도 남고, GitHub 에는 올라가지 않음)

## 폴더 구조

```text
backend/
├── app/
│   ├── main.py          서버 시작점 (API + 화면 파일 제공 + /docs)
│   ├── config.py        설정값 모음 ((임의) 값은 여기서 확인, 바꿀 때는 .env 사용)
│   ├── db.py            DB 연결
│   ├── models.py        DB 표 (users, sessions, attempts, teams, team_members, invites, timetable_entries, votes, vote_options, ballots, meetings, goals, todos)
│   ├── security.py      비밀번호 해시, 로그인 세션, 시도 횟수 제한
│   ├── errors.py        오류 응답 형식 {code, message}
│   ├── routers/         auth, teams, timetable, availability, schedule(투표·회의), todos(목표·할 일)
│   └── services/
│       ├── availability.py   공통 공강 계산 (프론트 lib/availability.ts 와 같은 결과)
│       └── vote.py           투표 판정 (프론트 lib/vote.ts 와 같은 결과)
├── scripts/
│   ├── start.sh / stop.sh    서버 켜기 / 끄기
│   └── seed_demo.py          시연용 가짜 데이터 넣기
├── tests/               서버 테스트
├── requirements.txt     필요한 파이썬 패키지
└── .env.example         설정값 예시
```

## 처음 설치

```bash
cd ~/work/hackathon-campus-notice-/backend
pip install -r requirements.txt            # 한 번만 (~/.local 에 설치되어 서버를 꺼도 남음)
cp .env.example .env                       # 그리고 .env 안의 PUBLIC_BASE_URL 을 내 공개 주소로 고친다
cd ../frontend && npm install && npm run build   # 화면 만들기 → frontend/dist (없어도 API 는 동작, 안내 페이지가 보임)
```

`PUBLIC_BASE_URL` 은 서버마다 다릅니다. 로그인 쿠키 경로에 쓰이니 꼭 내 주소로 고치세요.
- 양진우 서버(최종 배포): `https://ahnbi4.suwon.ac.kr:5400/262ac22016049/`
- 개발·테스트: 각자 `https://ahnbi4.suwon.ac.kr:5400/<내 아이디>/`  (아이디 확인: `echo $JUPYTERHUB_USER`)

## 서버 켜기 · 끄기

```bash
cd ~/work/hackathon-campus-notice-/backend
bash scripts/start.sh      # 켜기 (이미 떠 있으면 끄고 다시 켬). 0.0.0.0:6000 에서 실행, 로그는 data/server.log
bash scripts/stop.sh       # 끄기
```

- 켠 뒤 `https://ahnbi4.suwon.ac.kr:5400/<내 아이디>/` 로 접속합니다. API 문서는 같은 주소 뒤에 `docs`.
- 화면(`frontend/dist`)을 새로 빌드했으면 서버를 다시 켜야 반영됩니다.
- 수동으로 켜려면: `python -m uvicorn app.main:app --host 0.0.0.0 --port 6000` (`backend/` 에서). `127.0.0.1` 로 켜면 밖에서 안 보입니다.
- `Port 6000 is not available` 이 뜨면 이미 떠 있는 것이니 `pkill -f uvicorn` 후 다시 켭니다. (`scripts/start.sh` 는 이 과정을 자동으로 합니다.)

### 서버가 꺼졌을 때 (발표·시연 전에 꼭 할 것)
서버는 **최대 3일**이면 자동으로 꺼지고, **3시간 동안 활동이 없어도** 꺼집니다. 다시 켜면 데이터(`backend/data`)는 그대로 남아 있습니다.
1. 실습 서버에 로그인해서 서버를 켠다.
2. 터미널에서 `cd ~/work/hackathon-campus-notice-/backend && bash scripts/start.sh`
3. 공개 주소로 접속해 확인한다.

## 시연용 가짜 데이터

```bash
cd ~/work/hackathon-campus-notice-/backend
python -m scripts.seed_demo            # 비어 있을 때만 넣음
python -m scripts.seed_demo --reset    # 주의: DB 를 전부 지우고 다시 넣음
```

모두 가짜입니다. 아이디 `jinwoo` `minsu` `jihoon` `seoyeon` `haneul`, 비밀번호는 모두 `1234`, 비밀번호 찾기 답은 `jinwoo`=제주, `minsu`=민수, 나머지=테스트. 공개 주소는 로그인 없이 누구나 접속하므로 **실제 이름·학번·비밀번호를 넣지 마세요.**

## 테스트

```bash
cd ~/work/hackathon-campus-notice-/backend
python -m pytest -q
```
공통 공강 계산은 프론트 `lib/availability.test.ts` 케이스를 옮겨 같은 결과인지 확인합니다. 테스트는 임시 DB 를 쓰므로 실제 데이터에 영향이 없습니다.

## GitHub 로 합치는 방법

각자 자기 서버에서 개발 → GitHub 에서 합침 → 양진우 서버에서 받아서 실행합니다.

```bash
# 내 서버: 작업 후 (개인 브랜치에서. main/develop 에 직접 올리지 않기)
git status                                  # 올라갈 파일 확인 (.env, DB 파일, node_modules, dist 는 없어야 함)
git add <파일들> && git commit -m "설명"
git push origin feature/이름
# GitHub 에서 feature/이름 → develop 으로 Pull Request 를 만들고 검토 후 Merge

# 양진우 서버: 합쳐진 코드를 받아 다시 켜기
cd ~/work/hackathon-campus-notice- && git checkout develop && git pull
pip install -r backend/requirements.txt     # 패키지가 바뀌었을 때
cd frontend && npm install && npm run build && cd ..   # 화면 코드가 바뀌었을 때
cd backend && bash scripts/start.sh
```
`backend/.env` 는 서버마다 따로 두는 파일이라 GitHub 에 올라가지 않습니다. 새 서버에서는 `cp .env.example .env` 후 `PUBLIC_BASE_URL` 을 고치세요.

## 임의로 정한 설정

`app/config.py` 에 모여 있고, `backend/.env` 에 같은 이름(대문자)으로 적으면 바뀝니다. 목록과 현재 값은 [`docs/API_SPEC.md`](../docs/API_SPEC.md) 5번을 보세요.
