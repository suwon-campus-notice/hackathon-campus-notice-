import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, TextField } from '../../components/ui'
import { auth } from '../../store'

export function ChangePasswordPage() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [currentWrong, setCurrentWrong] = useState(false)

  const mismatch = confirm !== '' && next !== confirm
  const ready = current !== '' && next !== '' && confirm !== '' && !mismatch

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!ready) return
    if (auth.changePassword(current, next)) navigate('/me')
    else setCurrentWrong(true)
  }

  return (
    <Screen>
      <TopBar title="비밀번호 변경" back={{ to: '/me' }} />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          <TextField
            label="현재 비밀번호"
            type="password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value)
              setCurrentWrong(false)
            }}
            error={currentWrong ? '현재 비밀번호가 맞지 않아요.' : undefined}
            autoComplete="current-password"
          />
          <TextField label="새 비밀번호" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
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
          <Button type="submit" disabled={!ready}>
            변경하기
          </Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
