/**
 * 테스트 계정(팀장, 팀원1~4) 한 사람씩 쓰기.
 * - 로그인할 때 서버 잠금을 얻는다. 다른 사람이 쓰는 중이면 못 들어간다.
 * - 화면을 만지면(터치·키 입력) 30초에 한 번 서버에 활동을 알린다.
 * - 10분 동안 아무 활동이 없으면 이 기기에서 자동 로그아웃하고 잠금을 푼다. 서버도 같은 기준으로 잠금을 푼다.
 */
const API = 'api/'
const IDLE_MS = 10 * 60 * 1000
const HEARTBEAT_MS = 30 * 1000
const KEY = 'coetus.testSession'

export interface LockResult {
  test: boolean
  ok?: boolean
  busy?: boolean
  minutesLeft?: number
  session?: string
}

export interface TestAccountInfo {
  loginId: string
  name: string
  busy: boolean
  minutesLeft: number
}

let current: { loginId: string; session: string } | null = null
let lastActivity = Date.now()
let lastBeat = 0
let timer: ReturnType<typeof setInterval> | null = null
let onExpire: (() => void) | null = null

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
  if (saved && saved.loginId && saved.session) current = saved
} catch { /* 없으면 없는 대로 */ }

function save() {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current))
    else localStorage.removeItem(KEY)
  } catch { /* 무시 */ }
}

async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    return null
  }
}

/** 테스트 계정이면 잠금을 얻는다. 일반 계정이면 { test: false } */
export async function acquire(loginId: string): Promise<LockResult> {
  const r = await post('lock/acquire', { loginId, session: current?.loginId === loginId ? current.session : null })
  if (!r) return { test: false }                       // 서버 없음 → 일반 계정처럼 취급
  const j = (await r.json()) as LockResult
  if (j.test && j.ok && j.session) { current = { loginId, session: j.session }; save(); lastActivity = Date.now(); lastBeat = 0 }
  return j
}

export async function release(): Promise<void> {
  if (!current) return
  const c = current
  current = null; save()
  await post('lock/release', c)
}

export function isTestSession(): boolean {
  return current !== null
}

/** 로그인 뒤 호출. 활동 감시와 하트비트를 시작한다. expire 는 10분 무활동이나 잠금을 잃었을 때 호출된다. */
export function watch(expire: () => void) {
  onExpire = expire
  if (timer) return
  const touch = () => { lastActivity = Date.now() }
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'scroll']) document.addEventListener(ev, touch, { passive: true })
  timer = setInterval(() => void tick(), 5000)
}

async function tick() {
  if (!current) return
  const now = Date.now()
  if (now - lastActivity > IDLE_MS) {               // 10분 동안 아무것도 안 함
    await release()
    onExpire?.()
    return
  }
  if (lastActivity > lastBeat && now - lastBeat > HEARTBEAT_MS) {
    lastBeat = now
    const r = await post('lock/heartbeat', current)
    if (r && r.status === 409) {                    // 서버가 잠금을 풀고 다른 사람이 가져감
      current = null; save()
      onExpire?.()
    }
  }
}

export async function listTestAccounts(): Promise<{ accounts: TestAccountInfo[]; idleMinutes: number } | null> {
  try {
    const r = await fetch(API + 'test-accounts', { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as { accounts: TestAccountInfo[]; idleMinutes: number }
  } catch {
    return null
  }
}

/** 암호가 맞으면 서버가 테스트 계정·팀만 예시로 되돌린다 */
export async function resetTestTeam(password: string): Promise<{ ok: boolean; reason?: string }> {
  const r = await post('test-reset', { password })
  if (!r) return { ok: false, reason: '서버에 연결할 수 없어요' }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; reason?: string }
  return { ok: Boolean(j.ok), reason: j.reason }
}
