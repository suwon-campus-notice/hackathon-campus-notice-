import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card, TextField } from '../../components/ui'
import { auth } from '../../store'

/** 답을 틀릴 수 있는 최대 횟수 */
const MAX_ATTEMPTS = 5

export function FindPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loginId, setLoginId] = useState('')
  const [idError, setIdError] = useState<string>()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [wrongCount, setWrongCount] = useState(0)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [resetError, setResetError] = useState<string>()

  async function submitId(e: FormEvent) {
    e.preventDefault()
    const q = await auth.questionFor(loginId)
    if (!q.ok) {
      setIdError(q.message)
      return
    }
    setIdError(undefined)
    setQuestion(q.question)
    setWrongCount(0)
    setAnswer('')
    setStep(2)
  }

  async function submitAnswer(e: FormEvent) {
    e.preventDefault()
    if (answer.trim() === '') return
    const result = await auth.checkAnswer(loginId, answer)
    if (result.ok) setStep(3)
    // 서버가 막았으면(5번 틀림) 바로 잠금 화면으로 보낸다
    else setWrongCount((n) => (result.blocked ? MAX_ATTEMPTS : n + 1))
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault()
    if (password === '' || password !== confirm) return
    const result = await auth.resetPassword(loginId, answer, password)
    if (result.ok) navigate('/login')
    else setResetError(result.message)
  }

  if (wrongCount >= MAX_ATTEMPTS) {
    return (
      <Screen>
        <TopBar title="잠시 후에 다시 시도해 주세요" description="답을 5번 틀렸어요. 계정을 지키기 위해 잠시 동안 비밀번호 찾기를 쓸 수 없어요." />
        <BottomActions>
          <Button to="/login">로그인으로 돌아가기</Button>
        </BottomActions>
      </Screen>
    )
  }

  if (step === 1) {
    return (
      <Screen>
        <TopBar title="비밀번호 찾기" back={{ to: '/login' }} description="1/3 · 아이디를 입력해 주세요." />
        <form onSubmit={submitId} className="flex flex-1 flex-col">
          <Body>
            <TextField
              label="아이디"
              value={loginId}
              onChange={(e) => {
                setLoginId(e.target.value)
                setIdError(undefined)
              }}
              error={idError}
              autoComplete="username"
              autoCapitalize="none"
            />
          </Body>
          <BottomActions>
            <Button type="submit" disabled={loginId.trim() === ''}>
              다음
            </Button>
          </BottomActions>
        </form>
      </Screen>
    )
  }

  if (step === 2) {
    const left = MAX_ATTEMPTS - wrongCount
    return (
      <Screen>
        <TopBar title="비밀번호 찾기" back={{ onClick: () => setStep(1) }} description="2/3 · 가입할 때 고른 질문에 답해 주세요." />
        <form onSubmit={submitAnswer} className="flex flex-1 flex-col">
          <Body>
            <Card>
              <div className="text-[15px] font-medium">{question}</div>
            </Card>
            <TextField
              label="답"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              error={wrongCount > 0 ? `답이 맞지 않아요. ${left}번 더 시도할 수 있어요.` : undefined}
            />
          </Body>
          <BottomActions>
            <Button type="submit" disabled={answer.trim() === ''}>
              다음
            </Button>
          </BottomActions>
        </form>
      </Screen>
    )
  }

  const mismatch = confirm !== '' && password !== confirm
  return (
    <Screen>
      <TopBar title="새 비밀번호" description="3/3 · 새 비밀번호를 입력해 주세요." />
      <form onSubmit={submitPassword} className="flex flex-1 flex-col">
        <Body>
          <TextField
            label="새 비밀번호"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setResetError(undefined)
            }}
            error={resetError}
            autoComplete="new-password"
          />
          <TextField
            label="새 비밀번호 확인"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={mismatch ? '비밀번호가 서로 달라요.' : undefined}
            autoComplete="new-password"
          />
        </Body>
        <BottomActions>
          <Button type="submit" disabled={password === '' || confirm === '' || mismatch}>
            비밀번호 변경
          </Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
