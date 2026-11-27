"""공통 공강 계산. 프론트 frontend/src/lib/availability.ts 와 같은 결과가 나와야 한다.

규칙 (docs/screens.md 3.3):
- 바쁜 시간만 입력받고, 나머지를 가능한 시간으로 본다.
- 요일마다 '전원이 가능한 시간'이 있으면 그 시간만, 없으면 '가장 많은 인원이 가능한 시간'만 보여준다.
- 추천은 인원이 많은 순 → 긴 순 → 이른 요일 순으로 최대 3개, 1시간 이상인 구간만.
- 계산 범위는 설정(availability_start_hour ~ availability_end_hour, 기본 9~21시), 30분 칸.

이 파일은 DB·웹과 상관없는 순수 계산이라서, 입력은 (요일, 시작, 종료) 목록이면 된다. 시간은 시 단위 소수(9.5 = 9시 30분).
"""
from dataclasses import dataclass

from ..config import settings

DAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"]
MAX_PICKS = 3  # (임의가 아닌 UI 규칙) 추천 개수
MIN_PICK_HOURS = 1  # 1시간 이상 구간만 추천


@dataclass(frozen=True)
class Busy:
    day: int
    start: float
    end: float


def format_hour(h: float) -> str:
    """9.5 → "09:30", 24 → "24:00" (프론트 formatHour 와 같음)"""
    return f"{int(h // 1):02d}:{'30' if h % 1 else '00'}"


def is_busy(entries: list[Busy], day: int, t: float) -> bool:
    return any(e.day == day and e.start <= t < e.end for e in entries)


def compute_availability(timetables: list[list[Busy]], window_start: float | None = None, window_end: float | None = None) -> dict:
    """timetables: 팀원마다 바쁜 시간 목록 (시간표를 입력한 팀원만 넣는다).

    돌려주는 모양은 프론트 Availability 와 같다: {total, days: [{day, people, ranges, slots}], picks}
    """
    start_h = settings.availability_start_hour if window_start is None else window_start
    end_h = settings.availability_end_hour if window_end is None else window_end
    total = len(timetables)
    slot_count = int((end_h - start_h) * 2)

    days = []
    for day in range(7):
        slots = [sum(1 for entries in timetables if not is_busy(entries, day, start_h + s / 2)) for s in range(slot_count)]
        best = 0 if total == 0 else max(slots)
        ranges = []
        run_start = None
        for s in range(slot_count + 1):
            ok = best > 0 and s < slot_count and slots[s] == best
            if ok and run_start is None:
                run_start = s
            if not ok and run_start is not None:
                ranges.append({"start": start_h + run_start / 2, "end": start_h + s / 2})
                run_start = None
        days.append({"day": day, "people": best, "ranges": ranges, "slots": slots})

    picks = [
        {
            "day": d["day"],
            "start": r["start"],
            "end": r["end"],
            "people": d["people"],
            "label": f"{DAY_LABELS[d['day']]} {format_hour(r['start'])} ~ {format_hour(r['end'])}",
        }
        for d in days
        for r in d["ranges"]
        if r["end"] - r["start"] >= MIN_PICK_HOURS
    ]
    # 인원 많은 순 → 긴 순 → 이른 요일 순 (같으면 원래 순서 유지, 프론트 sort 와 동일)
    picks.sort(key=lambda p: (-p["people"], -(p["end"] - p["start"]), p["day"]))
    return {"total": total, "days": days, "picks": picks[:MAX_PICKS]}


def who_is_free(members: list[tuple[str, list[Busy]]], day: int, t: float) -> tuple[list[str], list[str]]:
    """그 요일·시각(30분 칸의 시작)에 가능한 팀원과 바쁜 팀원 이름. (프론트 membersAt 과 같음)"""
    free, busy = [], []
    for name, entries in members:
        (busy if is_busy(entries, day, t) else free).append(name)
    return free, busy
