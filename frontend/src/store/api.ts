/**
 * 백엔드 API 호출.
 * 주소는 항상 상대 경로(`api/...`)로 부른다. 공개 주소가 /<아이디>/ 로 시작하기 때문에
 * `/api/...` 처럼 / 로 시작하면 깨진다.
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly extra: Record<string, unknown>

  constructor(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.extra = extra
  }
}

/** 테스트에서 서버 주소를 바꿔 끼울 수 있게 둔다 (브라우저에서는 빈 값) */
let base = ''
export function setApiBase(url: string) {
  base = url
}

type Fetcher = typeof fetch
let fetcher: Fetcher = (...args) => fetch(...args)
export function setFetcher(f: Fetcher) {
  fetcher = f
}

export async function api<T = void>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetcher(`${base}api/${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'network', '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.')
  }
  if (res.status === 204) return undefined as T
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // JSON 이 아닌 응답은 아래에서 오류로 처리한다
  }
  if (!res.ok) {
    const d = (data ?? {}) as { code?: string; message?: string } & Record<string, unknown>
    const { code, message, ...extra } = d
    throw new ApiError(res.status, code ?? 'unknown', message ?? '요청을 처리하지 못했어요.', extra)
  }
  return data as T
}

/** 서버가 떠 있는지 확인한다. JSON 으로 {ok:true} 를 돌려줄 때만 서버가 있다고 본다. */
export async function serverIsUp(): Promise<boolean> {
  try {
    const res = await fetcher(`${base}api/health`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok === true
  } catch {
    return false
  }
}
