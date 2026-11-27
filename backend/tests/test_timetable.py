"""4단계: 시간표"""


def add(c, day=0, start=10, end=12, kind="class"):
    return c.post("/api/timetable", json={"day": day, "start": start, "end": end, "kind": kind})


def test_requires_login(client):
    assert client.get("/api/timetable").status_code == 401
    assert add(client).status_code == 401
    assert client.delete("/api/timetable/1").status_code == 401


def test_add_list_delete_shape_matches_types_ts(make_user):
    c = make_user("jinwoo")
    r = add(c, 2, 9.5, 11)
    assert r.status_code == 201
    e = r.json()
    assert e == {"id": e["id"], "day": 2, "start": 9.5, "end": 11.0, "kind": "class"}
    assert isinstance(e["id"], str)
    assert c.get("/api/timetable").json() == [e]
    assert c.delete(f"/api/timetable/{e['id']}").status_code == 204
    assert c.get("/api/timetable").json() == []


def test_list_sorted_by_day_then_time(make_user):
    c = make_user("jinwoo")
    add(c, 3, 9, 10)
    add(c, 0, 14, 15)
    add(c, 0, 10, 11)
    assert [(e["day"], e["start"]) for e in c.get("/api/timetable").json()] == [(0, 10), (0, 14), (3, 9)]


def test_both_kinds_and_full_day_range(make_user):
    c = make_user("jinwoo")
    assert add(c, 5, 0, 24, "blocked").status_code == 201  # 하루 전체(00:00~24:00)도 저장 가능
    assert add(c, 6, 21.5, 23.5, "class").status_code == 201  # 기본 표시(21시) 밖
    assert add(c, 1, 9, 10, "etc").status_code == 422


def test_end_must_be_after_start(make_user):
    c = make_user("jinwoo")
    for s, e in ((12, 10), (10, 10)):
        r = add(c, 0, s, e)
        assert r.status_code == 400 and r.json()["code"] == "invalid_order"


def test_only_30_minute_steps_within_a_day(make_user):
    c = make_user("jinwoo")
    for s, e in ((9.25, 10), (9, 10.1), (-1, 3), (20, 24.5)):
        assert add(c, 0, s, e).json()["code"] == "invalid_time", (s, e)
    assert add(c, 7, 9, 10).json()["code"] == "invalid_day"
    assert add(c, -1, 9, 10).json()["code"] == "invalid_day"


def test_overlap_rejected_with_conflict_info(make_user):
    c = make_user("jinwoo")
    first = add(c, 0, 10, 12).json()
    for s, e in ((11, 13), (9, 10.5), (10, 12), (10.5, 11), (9, 13)):
        r = add(c, 0, s, e)
        assert r.status_code == 409 and r.json()["code"] == "overlap", (s, e)
        assert r.json()["conflict"] == first
    assert len(c.get("/api/timetable").json()) == 1


def test_adjacent_or_other_day_is_not_overlap(make_user):
    c = make_user("jinwoo")
    add(c, 0, 10, 12)
    assert add(c, 0, 12, 13).status_code == 201  # 딱 붙어 있는 건 허용
    assert add(c, 0, 9, 10).status_code == 201
    assert add(c, 1, 10, 12).status_code == 201  # 다른 요일


def test_can_re_add_after_delete(make_user):
    c = make_user("jinwoo")
    e = add(c, 0, 10, 12).json()
    c.delete(f"/api/timetable/{e['id']}")
    assert add(c, 0, 11, 13).status_code == 201  # '수정'은 삭제 후 다시 추가


def test_timetables_are_private_per_user(make_user):
    a, b = make_user("jinwoo"), make_user("minsu")
    e = add(a, 0, 10, 12).json()
    assert b.get("/api/timetable").json() == []
    assert add(b, 0, 10, 12).status_code == 201  # 남의 일정과는 겹쳐도 된다
    assert b.delete(f"/api/timetable/{e['id']}").status_code == 404  # 남의 것은 못 지움
    assert b.delete("/api/timetable/abc").status_code == 404
    assert len(a.get("/api/timetable").json()) == 1
