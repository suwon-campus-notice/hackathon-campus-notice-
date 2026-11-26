/** 클래스 이름을 이어 붙인다. false/undefined 는 무시한다. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
