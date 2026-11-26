import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Screen } from '../../components/layout'
import { Button, TextField } from '../../components/ui'
import { auth, useStore } from '../../store'
import { listTestAccounts, resetTestTeam, type TestAccountInfo } from '../../store/testSession'

const linkClass = 'inline-flex min-h-11 items-center px-2 text-sm text-ink-2'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const connected = useStore((s) => s.connected)
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const expired = new URLSearchParams(location.search).get('expired') === '1'

  // 테스트 계정 목록 (서버가 있을 때만)
  const [testAccounts, setTestAccounts] = useState<TestAccountInfo[]>([])
  const [idleMinutes, setIdleMinutes] = useState(10)
  useEffect(() => {
    if (!connected) return
    let alive = true
    const load = () => void listTestAccounts().then((r) => { if (alive && r) { setTestAccounts(r.accounts); setIdleMinutes(r.idleMinutes) } })
    load()
    const t = setInterval(load, 5000)
    return () => { alive = false; clearInterval(t) }
  }, [connected])

  // 테스트 팀 초기화 (암호 필요)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPw, setResetPw] = useState('')
  const [resetMsg, setResetMsg] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setFailed(false)
    setBusy(null)
    const r = await auth.login(loginId.trim(), password)
    setSubmitting(false)
    if (r.ok) navigate('/teams')
    else if (r.reason === 'busy') setBusy(r.minutesLeft ?? idleMinutes)
    else setFailed(true)
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault()
    const r = await resetTestTeam(resetPw)
    setResetMsg(r.ok ? '테스트 계정과 테스트 팀을 예시 상태로 되돌렸어요.' : (r.reason ?? '되돌리지 못했어요.'))
    if (r.ok) setResetPw('')
  }

  // 어느 쪽이 틀렸는지 알려 주지 않도록 두 칸 모두 같은 상태로 표시한다
  const errorProps = failed ? { 'aria-invalid': true, className: 'border-2 border-danger' } : {}

  return (
    <Screen>
      <div className="flex flex-1 flex-col justify-center gap-10 px-6 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 text-[32px] font-bold tracking-tight text-accent">Coetus</h1>
          <p className="m-0 text-[15px] text-muted">팀플 시간을 한곳에서 맞춰요.</p>
        </div>

        {expired && !failed && busy === null && (
          <p role="status" className="m-0 rounded-control bg-accent-soft px-3.5 py-3 text-[13px] text-accent-ink">
            {idleMinutes}분 동안 활동이 없어 자동으로 로그아웃됐어요. 다시 로그인해 주세요.
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <TextField
            label="아이디"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            {...errorProps}
          />
          <TextField
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            {...errorProps}
          />
          {failed && (
            <p role="alert" className="m-0 text-[13px] font-medium text-danger">
              아이디 또는 비밀번호가 맞지 않아요. 다시 확인해 주세요.
            </p>
          )}
          {busy !== null && (
            <p role="alert" className="m-0 text-[13px] font-medium text-danger">
              이 테스트 계정은 지금 다른 사람이 사용 중이에요. 그 사람이 로그아웃하거나 활동이 없으면 약 {busy}분 뒤에 풀려요.
            </p>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? '확인 중…' : '로그인'}
          </Button>
        </form>

        {testAccounts.length > 0 && (
          <section className="flex flex-col gap-2 rounded-control border border-line bg-surface p-3.5">
            <h2 className="m-0 text-sm font-bold">테스트 계정 (비밀번호 1234)</h2>
            <p className="m-0 text-xs text-muted">
              한 계정은 한 사람만 쓸 수 있어요. {idleMinutes}분 동안 활동이 없으면 자동 로그아웃돼요. 누르면 아이디가 채워져요.
            </p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {testAccounts.map((a) => (
                <li key={a.loginId}>
                  <button
                    type="button"
                    disabled={a.busy}
                    onClick={() => { setLoginId(a.loginId); setPassword('1234'); setFailed(false); setBusy(null) }}
                    className={`min-h-9 rounded-full border px-3 text-[13px] ${a.busy ? 'cursor-not-allowed border-line bg-soft text-muted' : 'border-line-strong bg-surface text-ink'}`}
                    title={a.busy ? `사용 중 · 약 ${a.minutesLeft}분 뒤 풀림` : a.loginId}
                  >
                    {a.name}
                    {a.busy ? ` · 사용 중(${a.minutesLeft}분)` : ''}
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setResetOpen((v) => !v)} className="self-start bg-transparent p-0 text-xs text-ink-2 underline">
              테스트 계정·팀 초기화
            </button>
            {resetOpen && (
              <form onSubmit={submitReset} className="flex flex-col gap-2">
                <TextField
                  label="초기화 암호"
                  type="password"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  hint="테스트 계정(팀장, 팀원1~4)과 테스트 팀만 예시 상태로 돌아가요. 다른 계정과 팀은 그대로예요."
                />
                <Button type="submit" variant="secondary">
                  초기화
                </Button>
                {resetMsg && (
                  <p role="status" className="m-0 text-[13px] text-ink-2">
                    {resetMsg}
                  </p>
                )}
              </form>
            )}
          </section>
        )}

        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">
            <Link to="/find-id" className={linkClass}>
              아이디 찾기
            </Link>
            <span aria-hidden className="text-line-strong">
              |
            </span>
            <Link to="/find-password" className={linkClass}>
              비밀번호 찾기
            </Link>
          </div>
          <p className="m-0 flex items-center gap-1 text-sm text-muted">
            아직 계정이 없나요?
            <Link to="/signup" className="inline-flex min-h-11 items-center px-1 font-bold text-accent">
              회원가입
            </Link>
          </p>
        </div>
      </div>
    </Screen>
  )
}
