"""5단계: 공통 공강.
앞쪽은 프론트 lib/availability.test.ts, pages/schedule/teamAvailability.test.ts 의 케이스를 그대로 옮긴 것."""
from app.services.availability import Busy, compute_availability


def entry(day, start, end):
    return Busy(day, start, end)


# ── lib/availability.test.ts 와 같은 케이스 ──

def test_no_busy_time_means_everyone_free_all_day():
    r = compute_availability([[], []])
    assert r["total"] == 2
    assert r["days"][0]["people"] == 2
    assert r["days"][0]["ranges"] == [{"start": 9, "end": 21}]


def test_everyone_free_time_wins():
    r = compute_availability([[entry(0, 9, 12)], [entry(0, 10, 14)]])
    assert r["days"][0]["people"] == 2
    assert r["days"][0]["ranges"] == [{"start": 14, "end": 21}]


def test_when_nobody_is_fully_free_show_most_people():
    r = compute_availability([[entry(0, 9, 21)], [entry(0, 9, 14)], [entry(0, 9, 12)]])
    assert r["days"][0]["people"] == 2
    assert r["days"][0]["ranges"] == [{"start": 14, "end": 21}]


def test_day_nobody_can_has_no_range():
    r = compute_availability([[entry(2, 9, 21)]])
    assert r["days"][2]["people"] == 0
    assert r["days"][2]["ranges"] == []


def test_picks_order_and_one_hour_minimum():
    r = compute_availability([[entry(0, 9, 20.5), entry(1, 9, 18)], []])
    labels = [p["label"] for p in r["picks"]]
    assert labels[0].startswith("수")
    assert "월 20:30 ~ 21:00" not in labels
    assert len(r["picks"]) <= 3


def test_no_members_gives_empty_result():
    r = compute_availability([])
    assert r["picks"] == []
    assert all(not d["ranges"] for d in r["days"])


# ── 추가 케이스 (계산 세부) ──

def test_slots_are_30_minute_cells_from_9_to_21():
    r = compute_availability([[entry(0, 9.5, 10.5)], []])
    slots = r["days"][0]["slots"]
    assert len(slots) == 24
    assert slots[:4] == [2, 1, 1, 2]  # 9:00 둘 다 가능, 9:30·10:00 한 명 바쁨, 10:30 부터 다시 둘


def test_split_ranges_and_pick_label_format():
    r = compute_availability([[entry(1, 12, 13)]])
    assert r["days"][1]["ranges"] == [{"start": 9, "end": 12}, {"start": 13, "end": 21}]
    assert r["picks"][0]["label"] == "월 09:00 ~ 21:00"  # 같은 인원이면 긴 순, 같으면 이른 요일 순
    assert r["picks"][0]["people"] == 1 and r["picks"][0]["day"] == 0


def test_picks_max_three_longest_first():
    r = compute_availability([[entry(0, 9, 12), entry(1, 9, 11), entry(2, 9, 10), entry(3, 9, 9.5)]])
    assert [p["day"] for p in r["picks"]] == [4, 5, 6]  # 금·토·일은 하루 종일 가능(12시간), 최대 3개


def test_busy_outside_window_is_ignored():
    r = compute_availability([[entry(0, 21, 24), entry(0, 0, 9)]])
    assert r["days"][0]["ranges"] == [{"start": 9, "end": 21}]


def test_custom_window():
    r = compute_availability([[]], window_start=10, window_end=12)
    assert r["days"][0]["ranges"] == [{"start": 10, "end": 12}] and len(r["days"][0]["slots"]) == 4


# ── API: pages/schedule/teamAvailability.test.ts 와 같은 상황 ──

def add(c, day, start, end, kind="class"):
    assert c.post("/api/timetable", json={"day": day, "start": start, "end": end, "kind": kind}).status_code == 201


def make_team_of_four(make_user):
    jin, minsu, jihoon, seoyeon = (make_user(i, n) for i, n in (("jinwoo", "진우"), ("minsu", "민수"), ("jihoon", "지훈"), ("seoyeon", "서연")))
    t = jin.post("/api/teams", json={"name": "t1"}).json()
    for c in (minsu, jihoon, seoyeon):
        c.post(f"/api/invites/{t['inviteCode']}/join")
    return t, jin, minsu, jihoon, seoyeon


def test_api_excludes_members_without_timetable_and_names_them(make_user):
    t, jin, minsu, jihoon, seoyeon = make_team_of_four(make_user)
    add(jin, 0, 10, 12)
    add(jihoon, 0, 10, 12)
    r = jin.get(f"/api/teams/{t['id']}/availability").json()
    assert r["entered"] == 2 and r["total"] == 2
    assert r["notEntered"] == ["민수", "서연"]
    assert len(r["days"]) == 7 and r["days"][0]["ranges"] == [{"start": 9, "end": 10}, {"start": 12, "end": 21}]
    assert r["picks"][0]["people"] == 2


def test_api_who_is_free_names(make_user):
    t, jin, minsu, jihoon, seoyeon = make_team_of_four(make_user)
    add(jin, 0, 9, 10)
    add(minsu, 0, 9.5, 10.5)
    r = jin.get(f"/api/teams/{t['id']}/availability").json()
    d = r["days"][0]
    assert d["free"][0] == ["민수"] and d["busy"][0] == ["진우"]  # 9:00
    assert d["free"][1] == [] and d["busy"][1] == ["진우", "민수"]  # 9:30 은 둘 다 바쁨
    assert len(d["free"]) == len(d["busy"]) == len(d["slots"]) == 24


def test_api_nobody_entered(make_user):
    t, jin, *_ = make_team_of_four(make_user)
    r = jin.get(f"/api/teams/{t['id']}/availability").json()
    assert r["total"] == 0 and r["picks"] == [] and r["notEntered"] == ["진우", "민수", "지훈", "서연"]


def test_api_permissions(client, make_user):
    t, jin, *_ = make_team_of_four(make_user)
    outsider = make_user("outsider")
    assert client.get(f"/api/teams/{t['id']}/availability").status_code == 401
    assert outsider.get(f"/api/teams/{t['id']}/availability").status_code == 404
