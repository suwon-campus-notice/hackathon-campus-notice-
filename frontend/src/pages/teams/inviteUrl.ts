/** 초대 링크 주소 (HashRouter 기준) */
export function inviteUrl(code: string): string {
  return `${location.origin}${location.pathname}#/join/${code}`
}
