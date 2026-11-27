import { useState, type FormEvent } from 'react'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card, TextField } from '../../components/ui'
import { auth } from '../../store'

type Result = { kind: 'found'; loginId: string } | { kind: 'none' } | { kind: 'problem'; message: string } | null

export function FindIdPage() {
  const [name, setName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [result, setResult] = useState<Result>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (name.trim() === '' || studentId.trim() === '') return
    const found = await auth.findLoginId(name, studentId)
    if (found.ok) setResult({ kind: 'found', loginId: found.loginId })
    else if (found.reason === 'none') setResult({ kind: 'none' })
    else setResult({ kind: 'problem', message: found.message })
  }

  if (result?.kind === 'found') {
    return (
      <Screen>
        <TopBar title="아이디를 찾았어요" description="입력한 이름과 학번으로 가입한 계정이에요." />
        <Body>
          <Card>
            <div className="text-xs text-muted">아이디</div>
            <div className="mt-1 text-xl font-bold">{result.loginId}</div>
          </Card>
        </Body>
        <BottomActions>
          <Button to="/login">로그인하기</Button>
          <Button to="/find-password" variant="secondary">
            비밀번호 찾기
          </Button>
        </BottomActions>
      </Screen>
    )
  }

  if (result?.kind === 'problem') {
    return (
      <Screen>
        <TopBar title="아이디를 찾지 못했어요" description={result.message} />
        <BottomActions>
          <Button onClick={() => setResult(null)}>다시 입력하기</Button>
          <Button to="/login" variant="secondary">
            로그인으로 돌아가기
          </Button>
        </BottomActions>
      </Screen>
    )
  }

  if (result?.kind === 'none') {
    return (
      <Screen>
        <TopBar title="일치하는 계정이 없어요" description="이름이나 학번을 다시 확인해 주세요. 가입한 적이 없다면 회원가입을 해 주세요." />
        <BottomActions>
          <Button onClick={() => setResult(null)}>다시 입력하기</Button>
          <Button to="/signup" variant="secondary">
            회원가입
          </Button>
        </BottomActions>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar title="아이디 찾기" back={{ to: '/login' }} description="가입할 때 입력한 이름과 학번을 입력해 주세요." />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          <TextField label="이름" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <TextField label="학번" inputMode="numeric" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        </Body>
        <BottomActions>
          <Button type="submit" disabled={name.trim() === '' || studentId.trim() === ''}>
            아이디 찾기
          </Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
