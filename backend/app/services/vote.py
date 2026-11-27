"""투표 판정 규칙. 프론트 `frontend/src/lib/vote.ts` 와 같은 결과를 내야 한다 (테스트로 확인).

과반수는 전체 팀원 기준이다 (4명이면 3명).
"""
from dataclasses import dataclass


def majority(team_size: int) -> int:
    return team_size // 2 + 1


def tally(option_ids: list[int], ballots: dict[int, set[int]]) -> dict[int, int]:
    """후보별 득표 수. ballots: 사용자 id → 고른 후보 id 모음"""
    counts = {o: 0 for o in option_ids}
    for picked in ballots.values():
        for o in picked:
            if o in counts:
                counts[o] += 1
    return counts


@dataclass(frozen=True)
class Decision:
    kind: str  # 'confirmed' | 'tie' | 'pending'
    option_id: int | None = None  # confirmed 일 때 확정된 후보
    votes: int = 0  # confirmed 일 때 득표 수
    option_ids: tuple[int, ...] = ()  # tie 일 때 동률인 후보들


def decide(option_ids: list[int], ballots: dict[int, set[int]], team_size: int) -> Decision:
    """- 과반을 넘은 후보가 없으면 계속 진행(pending)
    - 과반을 넘은 후보 중 표가 가장 많은 후보로 확정
    - 최다표가 둘 이상이면 그 후보들끼리 재투표(tie)"""
    counts = tally(option_ids, ballots)
    need = majority(team_size)
    passed = [o for o in option_ids if counts[o] >= need]
    if not passed:
        return Decision("pending")
    top = max(counts[o] for o in passed)
    winners = [o for o in passed if counts[o] == top]
    if len(winners) == 1:
        return Decision("confirmed", option_id=winners[0], votes=top)
    return Decision("tie", option_ids=tuple(winners))


def single_top(option_ids: list[int], ballots: dict[int, set[int]]) -> int | None:
    """마감 후 과반이 없을 때, 팀장이 확정할 수 있는 단독 최다표 후보 (동률이거나 표가 없으면 None)"""
    counts = tally(option_ids, ballots)
    top = max([0, *counts.values()])
    if top == 0:
        return None
    winners = [o for o in option_ids if counts[o] == top]
    return winners[0] if len(winners) == 1 else None
