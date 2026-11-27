import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Screen } from '../../components/layout'
import { Button, TextField } from '../../components/ui'
import { auth } from '../../store'

const linkClass = 'inline-flex min-h-11 items-center px-2 text-sm text-ink-2'

export function LoginPage() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)

  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const result = await auth.login(loginId.trim(), password)
    setBusy(false)
    if (result === 'ok') navigate('/teams')
    // 'error' 는 화면 위 안내(서버 연결 오류 등)로 따로 알린다
    else if (result === 'wrong') setFailed(true)
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
          <Button type="submit" disabled={busy}>
            로그인
          </Button>
        </form>

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
