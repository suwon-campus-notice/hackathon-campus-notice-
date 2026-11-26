/**
 * 서버 동기화 (backend/app/main.py 와 짝).
 *
 * 생각하는 방식: 앱 상태 중 "공유되는 부분"(사용자·팀·시간표·투표·회의·목표·할 일·계정)을 문서 하나로 보고,
 * - 내 변경은 화면에 먼저 반영한 뒤 문서 전체를 PUT 으로 보낸다 (base = 내가 알고 있던 version).
 * - 그 사이 다른 기기가 먼저 바꿨으면 서버가 409 와 최신 문서를 준다 → 최신 문서 위에 내 변경(액션)을 다시 실행해서 다시 보낸다.
 * - 다른 기기의 변경은 2.5초마다 GET ?since=version 으로 받는다 (바뀐 게 없으면 서버가 unchanged 만 답한다).
 *
 * 서버가 없으면(예: 정적 호스팅) 연결 실패를 한 번 확인하고 그냥 예시 데이터로 동작한다.
 */

export interface SyncOptions<S> {
  /** 공유 문서(현재 상태의 공유 부분) */
  getShared: () => S
  /** 서버에서 받은 문서를 상태에 반영 */
  applyRemote: (shared: S) => void
  /** 서버가 비어 있을 때 올릴 예시 데이터 */
  seed: () => S
  /** 연결 여부가 바뀌면 알림 (화면 표시용) */
  onStatus?: (status: SyncStatus) => void
}

export interface SyncStatus {
  /** 서버에 한 번이라도 닿았는지 */
  connected: boolean
  /** 첫 로딩이 끝났는지 (서버가 없어도 true 가 된다) */
  ready: boolean
  version: number
}

const API = 'api/'
const POLL_MS = 2500

export function createSync<S>(opts: SyncOptions<S>) {
  let version = 0
  let connected = false
  let ready = false
  let pending: Array<() => void> = []
  let replaying = false
  let chain: Promise<void> = Promise.resolve()
  let inflight = false

  const status = () => opts.onStatus?.({ connected, ready, version })

  async function get(since: number): Promise<{ version: number; state: S | null; unchanged?: boolean } | null> {
    try {
      const r = await fetch(`${API}state${since ? `?since=${since}` : ''}`, { cache: 'no-store' })
      if (!r.ok) return null
      return (await r.json()) as { version: number; state: S | null; unchanged?: boolean }
    } catch {
      return null
    }
  }

  async function put(base: number, state: S): Promise<{ ok: true; version: number } | { ok: false; conflict: { version: number; state: S | null } } | null> {
    try {
      const r = await fetch(`${API}state`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base, state }) })
      if (r.status === 409) return { ok: false, conflict: (await r.json()) as { version: number; state: S | null } }
      if (!r.ok) return null
      return { ok: true, version: ((await r.json()) as { version: number }).version }
    } catch {
      return null
    }
  }

  /** 서버 문서를 받아 반영한다. 서버가 비어 있으면 예시 데이터를 올린다. */
  async function pull(force = false): Promise<boolean> {
    if (inflight || pending.length) return false
    const res = await get(force ? 0 : version)
    if (!res) {
      if (connected) { connected = false; status() }
      return false
    }
    if (!connected) { connected = true; status() }
    if (res.unchanged) return false
    version = res.version
    if (res.state === null) {
      // 서버가 비어 있다 → 예시 데이터를 올린다 (다른 기기가 먼저 올렸으면 409 → 그걸 받는다)
      const seed = opts.seed()
      const r = await put(version, seed)
      if (r && r.ok) { version = r.version; opts.applyRemote(seed) }
      else if (r && !r.ok && r.conflict.state) { version = r.conflict.version; opts.applyRemote(r.conflict.state) }
      status()
      return true
    }
    opts.applyRemote(res.state)
    status()
    return true
  }

  /** 상태를 바꾼 액션을 기록하고 서버로 보낸다. replay 는 409 때 최신 문서 위에 다시 실행할 함수. */
  function push(replay: () => void) {
    if (replaying) return
    pending.push(replay)
    chain = chain.then(flush).catch(() => {})
  }

  async function flush() {
    if (!pending.length) return
    inflight = true
    try {
      for (let i = 0; i < 5 && pending.length; i++) {
        const snapshot = pending.slice()
        const r = await put(version, opts.getShared())
        if (!r) { connected = false; status(); return }       // 네트워크 실패: 다음 변경 때 다시 시도
        if (r.ok) {
          version = r.version
          pending = pending.filter((f) => !snapshot.includes(f))
          if (!connected) { connected = true; status() }
          continue
        }
        // 충돌: 최신 문서 위에 내 변경을 다시 적용
        version = r.conflict.version
        if (r.conflict.state) opts.applyRemote(r.conflict.state)
        replaying = true
        try { pending.forEach((f) => { try { f() } catch { /* 더 이상 적용할 수 없는 변경은 버린다 */ } }) } finally { replaying = false }
      }
    } finally {
      inflight = false
    }
  }

  function start() {
    pull(true).finally(() => { ready = true; status() })
    setInterval(() => { if (document.visibilityState !== 'hidden') void pull() }, POLL_MS)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void pull() })
  }

  return { start, push, pull, isReplaying: () => replaying, get version() { return version } }
}
