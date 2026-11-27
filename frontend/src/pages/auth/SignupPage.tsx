import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, SelectField, TextField } from '../../components/ui'
import { SECURITY_QUESTIONS } from '../../mocks/seed'
import { auth } from '../../store'

type IdCheck = 'unchecked' | 'taken' | 'ok' | 'invalid'

export function SignupPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [idCheck, setIdCheck] = useState<IdCheck>('unchecked')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [studentId, setStudentId] = useState('')
  const [question, setQuestion] = useState<string>(SECURITY_QUESTIONS[0])
  const [answer, setAnswer] = useState('')
  const [submitted, setSubmitted] = useState(false)
  /** 서버가 알려 준 아이디·가입 오류 안내 */
  const [serverMessage, setServerMessage] = useState('')

  const mismatch = confirm !== '' && password !== confirm
  const required = (v: string) => (submitted && v.trim() === '' ? '입력해 주세요.' : undefined)

  async function checkId() {
    if (loginId.trim() === '') return
    const result = await auth.isLoginIdTaken(loginId)
    if (result.status === 'invalid') setServerMessage(result.message)
    setIdCheck(result.status)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    const filled = [name, loginId, password, confirm, studentId, answer].every((v) => v.trim() !== '')
    if (!filled || mismatch || idCheck !== 'ok') return
    const result = await auth.signup({ name, loginId, password, studentId, question, answer })
    if (result.ok) {
      navigate('/teams')
      return
    }
    setServerMessage(result.message)
    setIdCheck(result.code === 'taken' ? 'taken' : 'invalid')
  }

  const idError =
    idCheck === 'taken'
      ? '이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.'
      : idCheck === 'invalid'
        ? serverMessage
        : submitted && loginId.trim() !== '' && idCheck === 'unchecked'
        ? '중복 확인을 해 주세요.'
        : required(loginId)

  return (
    <Screen>
      <TopBar title="회원가입" back={{ to: '/login' }} description="이름과 학번을 입력하고 아이디와 비밀번호를 정해 주세요." />
      <form onSubmit={submit} className="flex flex-1 flex-col" noValidate>
        <Body className="pb-4">
          <TextField label="이름" value={name} onChange={(e) => setName(e.target.value)} error={required(name)} autoComplete="name" />

          <div className="flex flex-col gap-1.5">
            {/* 라벨 높이만큼 내려서 입력 칸과 버튼의 줄을 맞춘다 */}
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <TextField
                  label="아이디"
                  value={loginId}
                  onChange={(e) => {
                    setLoginId(e.target.value)
                    setIdCheck('unchecked')
                  }}
                  error={idError}
                  autoComplete="username"
                  autoCapitalize="none"
                />
              </div>
              <Button variant="secondary" inline className="mt-[26px] shrink-0" onClick={checkId}>
                중복 확인
              </Button>
            </div>
            {idCheck === 'ok' && (
              <p role="status" className="m-0 text-[13px] font-medium text-accent-ink">
                사용할 수 있는 아이디예요.
              </p>
            )}
          </div>

          <TextField
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={required(password)}
            autoComplete="new-password"
          />
          <TextField
            label="비밀번호 확인"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? '비밀번호가 서로 달라요.' : required(confirm)}
            autoComplete="new-password"
          />
          <TextField
            label="학번"
            inputMode="numeric"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            error={required(studentId)}
          />
          <SelectField label="비밀번호 찾기 질문" options={[...SECURITY_QUESTIONS]} value={question} onChange={(e) => setQuestion(e.target.value)} />
          <TextField
            label="답"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            error={required(answer)}
            hint="비밀번호를 잊었을 때 필요해요. 나만 아는 답을 적어 주세요."
          />
        </Body>
        <BottomActions>
          <Button type="submit">가입하기</Button>
          <p className="m-0 flex items-center justify-center gap-1 text-sm text-muted">
            이미 계정이 있나요?
            <Link to="/login" className="inline-flex min-h-11 items-center px-1 font-bold text-accent">
              로그인
            </Link>
          </p>
        </BottomActions>
      </form>
    </Screen>
  )
}
