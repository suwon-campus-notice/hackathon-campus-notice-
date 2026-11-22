/**
 * 선택한 칸 범위 [lo, hi] 에서 이미 찬 칸을 빼고, 빈 칸이 이어진 구간들을 돌려준다.
 * 구간은 [시작 칸, 끝 칸(포함)] 쌍이다.
 */
export function freeSegments(lo: number, hi: number, isBusy: (slot: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = []
  let start: number | null = null
  for (let i = lo; i <= hi + 1; i++) {
    const free = i <= hi && !isBusy(i)
    if (free && start === null) start = i
    if (!free && start !== null) {
      out.push([start, i - 1])
      start = null
    }
  }
  return out
}
