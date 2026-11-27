# Coetus API 명세 (1차: 계정 · 팀 · 시간표 · 공통 공강)

프론트가 이 문서만 보고 연결할 수 있도록 정리했습니다. 자동 문서(`/docs`, 같은 내용을 Swagger 로 보여줌)도 서버에서 열립니다.
**2차(회의 투표·확정, 목표·할 일)는 아직 없습니다.**

## 0. 공통 규칙

| 항목 | 내용 |
| --- | --- |
| 주소 | 항상 **상대 경로** `api/...` 로 부릅니다. 공개 주소가 `/<아이디>/` 로 시작해서 `/api/...` 는 깨집니다. 예) `fetch('api/teams')` |
| 로그인 | 로그인·가입하면 서버가 쿠키(`coetus_session`, HttpOnly)를 줍니다. 같은 주소에서 부르면 브라우저가 자동으로 보내므로 따로 할 일은 없습니다. 로그인이 필요한 API 에서 안 했으면 **401** `not_logged_in`. |
| 보내는 형식 | `Content-Type: application/json` |
| id | 모두 **문자열**(`"1"`). 프론트 `types.ts` 와 같습니다. |
| 요일 | `0=월 … 6=일` |
| 시간 | 시 단위 소수. `9.5` = 9시 30분, `24` = 24:00. 30분 단위 |
| 오류 | `{ "code": "영문_코드", "message": "화면에 보여줄 안내" }` (+ 코드에 따라 추가 필드). `code` 로 분기하고 `message` 는 그대로 보여주면 됩니다. |
| 형식이 아예 틀린 요청 | **422** `{ "code": "invalid_input", "message": "입력값을 확인해 주세요." }` |

### 프론트 `store/index.ts` 함수와의 대응

| store 함수 | API |
| --- | --- |
| (앱 시작 시 로그인 여부) | `GET api/auth/me` (401 이면 로그인 화면) |
| `auth.login` / `auth.logout` | `POST api/auth/login` / `POST api/auth/logout` |
| `auth.isLoginIdTaken` | `GET api/auth/check-id?loginId=` |
| `auth.signup` | `POST api/auth/signup` |
| `auth.findLoginId` | `POST api/auth/find-id` |
| `auth.questionFor` / `checkAnswer` / `resetPassword` | `POST api/auth/password-question` / `password-check` / `password-reset` |
| `auth.changePassword` | `POST api/auth/password-change` |
| `myTeams` | `GET api/teams` |
| `teamActions.create` / `join` / `renewInvite` / `transferLeader` / `leave` | `POST api/teams` / `POST api/invites/{code}/join` / `POST api/teams/{id}/invite/renew` / `POST api/teams/{id}/leader` / `POST api/teams/{id}/leave` |
| `teamActions.findByInvite` | `GET api/invites/{code}` |
| `timetableActions.add` / `remove` | `POST api/timetable` / `DELETE api/timetable/{id}` |
| `state.timetables[내 id]` | `GET api/timetable` |
| `teamAvailability`, `membersAt` | `GET api/teams/{id}/availability` |

> 주의: store 의 함수들은 지금 동기(바로 값을 돌려줌)인데 API 는 비동기입니다. 연결할 때 `await` 로 바뀌는 부분은 프론트에서 처리해야 합니다.

---

## 1. 계정 `api/auth/...`

사용자 모양 (`User`): `{ "id": "1", "name": "진우", "loginId": "jinwoo", "studentId": "20231234" }`

### `GET api/auth/questions` — 찾기 질문 목록
→ `["어릴 적 가장 좋아했던 장난감은?", "가장 기억에 남는 여행지는?", … (10개)]`

### `GET api/auth/check-id?loginId=jinwoo` — 아이디 중복 확인
→ `{ "taken": true }`. 아이디 규칙에 안 맞으면 400 `invalid_login_id`.

### `POST api/auth/signup` — 회원가입 (성공하면 바로 로그인 상태)
```json
{ "name": "진우", "loginId": "jinwoo", "password": "1234", "studentId": "20231234",
  "question": "가장 기억에 남는 여행지는?", "answer": "제주" }
```
→ **201** `User`. `question` 은 `questions` 목록에 있는 글자 그대로여야 합니다.
오류: 409 `login_id_taken`, 400 `invalid_login_id` / `invalid_password` / `invalid_input`.

### `POST api/auth/login`
`{ "loginId": "jinwoo", "password": "1234" }` → `User`. 실패 401 `login_failed`.

### `POST api/auth/logout` → 204
### `GET api/auth/me` → `User` (로그인 안 했으면 401)

### `POST api/auth/find-id` — 아이디 찾기
`{ "name": "진우", "studentId": "20231234" }` → `{ "loginId": "jinwoo" }`
오류: 404 `not_found`, **429** `too_many_attempts` (같은 접속 주소에서 10분에 5회까지, `retryAfterSeconds` 포함).

### 비밀번호 찾기 (3단계)
1. `POST api/auth/password-question` `{ "loginId": "jinwoo" }` → `{ "question": "가장 기억에 남는 여행지는?" }` (없는 아이디 404 `not_found`)
2. `POST api/auth/password-check` `{ "loginId": "jinwoo", "answer": "제주" }` → `{ "ok": true }`
3. `POST api/auth/password-reset` `{ "loginId": "jinwoo", "answer": "제주", "newPassword": "새비번" }` → `{ "ok": true }`
   (보안상 답을 한 번 더 보내야 합니다. 프론트는 2단계에서 입력한 답을 들고 있다가 3단계에 같이 보내세요.)

답이 틀리면 400 `wrong_answer` + `remainingTries`(남은 횟수). **5번 틀리면 15분간 429** `too_many_attempts` (그동안은 맞는 답도 거절). 맞히면 횟수가 초기화됩니다. 답은 띄어쓰기·대소문자를 무시합니다.

### `POST api/auth/password-change` — 비밀번호 변경 (로그인 필요)
`{ "currentPassword": "1234", "newPassword": "새비번" }` → `{ "ok": true }`. 현재 비밀번호가 틀리면 400 `wrong_password`.

---

## 2. 팀 `api/teams`, `api/invites`

팀 모양 (`Team`) — `types.ts` 의 `Team` + `members`(이름 표시용, 덧붙임):
```json
{ "id": "1", "name": "소프트웨어공학 팀플", "leaderId": "1", "memberIds": ["1", "2"],
  "inviteCode": "ehF-xW3noRzB", "inviteDaysLeft": 7,
  "members": [{ "id": "1", "name": "진우" }, { "id": "2", "name": "민수" }] }
```
- `inviteDaysLeft`: 초대 링크 만료까지 남은 일수. **0 이면 만료**.
- 초대 링크 전체 주소는 프론트가 `#/join/{inviteCode}` 로 만듭니다 (`inviteUrl.ts`). 서버는 코드만 줍니다.
- 팀원이 아니거나 없는 팀은 모두 404 `team_not_found` 입니다.

| 요청 | 권한 | 설명 |
| --- | --- | --- |
| `GET api/teams` | 로그인 | 내 팀 목록 `Team[]` |
| `POST api/teams` `{ "name": "팀 이름" }` | 로그인 | 만든 사람이 팀장, 초대 링크 포함. **201** `Team`. 이름이 비면 400 |
| `GET api/teams/{id}` | 팀원 | `Team` |
| `GET api/invites/{code}` | 로그인 | `{ "team": Team, "expired": false }` — 참여 화면용. 없는 코드/새 링크로 바뀐 옛 코드는 404 `invite_not_found` |
| `POST api/invites/{code}/join` | 로그인 | 참여 → `Team`. 이미 팀원이면 그대로 `Team`. 만료면 **410** `invite_expired`, 코드가 없으면 404 |
| `POST api/teams/{id}/invite/renew` | **팀장** | 새 링크 발급 → `Team`. **옛 링크는 바로 무효**(404). 새 링크는 7일 |
| `POST api/teams/{id}/leader` `{ "userId": "2" }` | **팀장** | 팀장 넘기기 → `Team`. 자기 자신/팀원 아닌 사람이면 400 `invalid_target` |
| `POST api/teams/{id}/leave` | 팀원 | 탈퇴 → 204. 팀장은 먼저 넘겨야 함: **409** `leader_must_transfer`. **팀장 혼자인 팀이면 팀이 삭제**됨 |

팀장이 아닌 사람이 팀장 전용 API 를 부르면 **403** `leader_only`.
팀원 내보내기 API 는 없습니다 (요구사항).

---

## 3. 시간표 `api/timetable` (로그인 필요, 내 것만)

`TimetableEntry`: `{ "id": "5", "day": 2, "start": 9.5, "end": 11, "kind": "class" }` — `kind` 는 `class`(수업) / `blocked`(활동 불가).

| 요청 | 설명 |
| --- | --- |
| `GET api/timetable` | 내 시간표 `TimetableEntry[]` (요일, 시작 순) |
| `POST api/timetable` `{ "day": 2, "start": 9.5, "end": 11, "kind": "class" }` | 추가 → **201** `TimetableEntry` |
| `DELETE api/timetable/{id}` | 삭제 → 204. 남의 것/없는 것은 404 `not_found` |

`POST` 오류:
- 400 `invalid_order` — 종료가 시작보다 빠르거나 같음
- 400 `invalid_time` — 30분 단위가 아니거나 0~24시 밖
- 400 `invalid_day` — 요일이 0~6 이 아님
- **409** `overlap` — 같은 요일에 겹침. `{ "code": "overlap", "message": "…", "conflict": TimetableEntry }`
- 422 — `kind` 가 `class`/`blocked` 가 아님 등

딱 붙은 시간(10~12 와 12~13)은 겹침이 아닙니다. 하루 전체(0~24)도 저장됩니다. 수정 API 는 없습니다(삭제 후 다시 추가).

---

## 4. 공통 공강 `GET api/teams/{id}/availability` (팀원)

서버가 팀원들의 시간표로 계산합니다 (규칙은 `frontend/src/lib/availability.ts` 와 같고, 테스트로 같은 결과를 확인함). 시간표를 입력한 팀원만 계산에 넣고, 입력 안 한 팀원은 `notEntered` 로 알려줍니다.

```json
{
  "total": 2,
  "entered": 2,
  "notEntered": ["민수", "서연"],
  "windowStart": 9, "windowEnd": 21,
  "days": [
    { "day": 0, "people": 2,
      "ranges": [{ "start": 9, "end": 10 }, { "start": 12, "end": 21 }],
      "slots": [2, 2, 1, …],
      "free": [["진우", "지훈"], …],
      "busy": [[], …] },
    …(월~일 7개)
  ],
  "picks": [
    { "day": 2, "start": 13, "end": 21, "people": 2, "label": "수 13:00 ~ 21:00" }
  ]
}
```
- `total`/`days`/`picks` 는 프론트 `Availability` 와 같은 모양입니다. `total` 은 **시간표를 입력한 팀원 수**(=`entered`).
- `days[].people`: 그날 가장 많이 가능한 인원. 전원이 가능한 시간이 있으면 `people == total` 이고 그 구간만 `ranges` 에 나옵니다. 없으면 가장 많은 인원이 가능한 구간만 나옵니다. 아무도 못 하는 요일은 `ranges` 가 비어 있습니다.
- `slots[i]`: 30분 칸(`windowStart` 부터, 24칸)마다 가능한 인원 수.
- `free[i]` / `busy[i]`: 같은 칸에 가능한/바쁜 팀원 이름 (칸을 눌렀을 때 보여주는 용도. 프론트 `membersAt` 대체. **`types.ts` 에 없는 덧붙인 필드**).
- `picks`: 추천 최대 3개. 인원 많은 순 → 긴 순 → 이른 요일 순, **1시간 이상**만.
- 팀원이 아니면 404 `team_not_found`.

---

## 5. 임의로 정한 값 (바꾸기 쉽게 `backend/app/config.py` / `backend/.env` 로 조정)

| 항목 | 현재 값 | 환경변수 |
| --- | --- | --- |
| 초대 링크 만료 | 7일 (확정) | `INVITE_EXPIRE_DAYS` |
| 아이디 규칙 | 영문·숫자·`_` 3~20자, 대소문자 구분 안 함 (가입 시 소문자로 저장) | `LOGIN_ID_MIN`, `LOGIN_ID_MAX` |
| 비밀번호 최소 길이 | 4자 | `PASSWORD_MIN` |
| 로그인 유지 | 14일 | `SESSION_DAYS` |
| 찾기 답 틀릴 수 있는 횟수 | 5회 (확정) | `ANSWER_MAX_FAILS` |
| 5회 초과 시 막는 시간 | 15분 (미정→임의) | `ANSWER_BLOCK_MINUTES` |
| 아이디 찾기 시도 제한 | 10분에 5회 (임의) | `FIND_ID_MAX_TRIES`, `FIND_ID_WINDOW_MINUTES` |
| 공통 공강 계산 범위 | 09~21시 (미정→임의) | `AVAILABILITY_START_HOUR`, `AVAILABILITY_END_HOUR` |
| 시간 단위 | 30분 (확정) | `TIMETABLE_SLOT_MINUTES` |
| 공개 주소 | — (서버마다 다름) | `PUBLIC_BASE_URL` |

## 6. 프론트 담당과 맞춰야 할 점

- **팀장 혼자인 팀의 탈퇴:** 서버는 팀을 삭제하지만, 프론트 `LeaveTeamPage` 는 팀장이면 항상 탈퇴 버튼을 막습니다.
- **API 응답 필드 추가:** `Team.members`, 공통 공강의 `days[].free/busy`, `notEntered`, `entered`, `windowStart/End` 는 `types.ts` 에 없는 덧붙인 필드입니다.
- **비밀번호 재설정:** 3단계 요청에 답을 한 번 더 보내야 합니다.
- **에러 처리:** 시간표 겹침(`overlap`)의 `conflict`, 투표·할 일(2차) 오류도 같은 `{code, message}` 형식을 씁니다.
- **프론트 빌드·배포 주소:** `base: './'` + HashRouter 이므로 `/<아이디>/` 아래에서 그대로 동작합니다 (공개 주소에서 확인함).
