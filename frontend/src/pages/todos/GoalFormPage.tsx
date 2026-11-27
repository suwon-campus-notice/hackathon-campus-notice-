import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, SelectField, TextField } from '../../components/ui'
import { todoActions, userName, type TodoDraft } from '../../store'
import { useTeamContext } from '../../routes/hooks'

const PLACEHOLDER = '선택'

interface Card {
  /** 화면에서 카드를 구분하는 키 */
  key: number
  /** 이미 저장된 할 일이면 그 id */
  id?: string
  title: string
  assigneeId: string
  due: string
}

interface CardError {
  title?: string
  assignee?: string
  due?: string
}

/** 목표 만들기(/goals/new)와 수정(/goals/:goalId/edit)을 한 화면에서 처리한다 */
export function GoalFormPage() {
  const { s, team, teamId, me, leader } = useTeamContext()
  const { goalId } = useParams()
  const navigate = useNavigate()
  const goal = goalId ? s.goals.find((g) => g.id === goalId && g.teamId === teamId) : undefined
  const editing = Boolean(goalId)

  const [title, setTitle] = useState(goal?.title ?? '')
  const [nextKey, setNextKey] = useState(10)
  const [cards, setCards] = useState<Card[]>(() =>
    goal
      ? s.todos
          .filter((t) => t.goalId === goal.id)
          .map((t, i) => ({ key: i, id: t.id, title: t.title, assigneeId: t.assigneeId, due: t.due }))
      : [
          { key: 0, title: '', assigneeId: '', due: '' },
          { key: 1, title: '', assigneeId: '', due: '' },
        ],
  )
  const [titleError, setTitleError] = useState('')
  const [errors, setErrors] = useState<Record<number, CardError>>({})

  const back = `/teams/${teamId}/todos`
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />
  if (!leader || (editing && !goal)) return <Navigate to={back} replace />

  const names = team.memberIds.map((id) => userName(s, id))
  const update = (key: number, patch: Partial<Card>) => setCards((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const nextErrors: Record<number, CardError> = {}
    for (const c of cards) {
      const err: CardError = {}
      if (!c.title.trim()) err.title = '제목을 입력해 주세요.'
      if (!c.assigneeId) err.assignee = '담당자를 골라 주세요.'
      if (!c.due) err.due = '마감일을 정해 주세요.'
      if (err.title || err.assignee || err.due) nextErrors[c.key] = err
    }
    const tError = title.trim() ? '' : '큰 목표를 입력해 주세요.'
    setTitleError(tError)
    setErrors(nextErrors)
    if (tError || Object.keys(nextErrors).length > 0) return

    const drafts: TodoDraft[] = cards.map((c) => ({ id: c.id, title: c.title.trim(), assigneeId: c.assigneeId, due: c.due }))
    if (goal) await todoActions.updateGoal(goal.id, title.trim(), drafts)
    else await todoActions.createGoal(teamId, title.trim(), drafts)
    navigate(back)
  }

  function addCard() {
    setCards((cs) => [...cs, { key: nextKey, title: '', assigneeId: '', due: '' }])
    setNextKey(nextKey + 1)
  }

  return (
    <Screen>
      <TopBar
        title={editing ? '목표 수정' : '목표 만들기'}
        back={{ to: back }}
        description={editing ? undefined : '큰 목표를 쓰고, 팀원별로 할 일을 나눠주세요.'}
      />
      <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
        <Body className="flex-1">
          <TextField label="큰 목표" value={title} error={titleError} onChange={(e) => setTitle(e.target.value)} />
          {cards.map((c, i) => {
            const err = errors[c.key] ?? {}
            return (
              <fieldset key={c.key} className="m-0 flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
                <legend className="px-1 text-sm font-bold">개인 목표 {i + 1}</legend>
                <TextField label="제목" value={c.title} error={err.title} onChange={(e) => update(c.key, { title: e.target.value })} />
                <SelectField
                  label="담당자"
                  options={[PLACEHOLDER, ...names]}
                  value={c.assigneeId ? userName(s, c.assigneeId) : PLACEHOLDER}
                  error={err.assignee}
                  onChange={(e) => {
                    const id = team.memberIds.find((m) => userName(s, m) === e.target.value) ?? ''
                    update(c.key, { assigneeId: id })
                  }}
                />
                <TextField label="마감일" type="date" value={c.due} error={err.due} onChange={(e) => update(c.key, { due: e.target.value })} />
                {editing && (
                  <Button variant="danger" inline className="self-start" onClick={() => setCards((cs) => cs.filter((x) => x.key !== c.key))}>
                    이 할 일 삭제
                  </Button>
                )}
              </fieldset>
            )
          })}
          <button
            type="button"
            onClick={addCard}
            className="min-h-12 rounded-control border border-dashed border-line-strong bg-transparent text-base font-medium text-accent-ink"
          >
            개인 목표 추가
          </button>
          {editing && goal && (
            <Link to={`${back}/goals/${goal.id}/delete`} className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-danger no-underline">
              이 목표 전체 삭제
            </Link>
          )}
        </Body>
        <BottomActions>
          <Button type="submit">저장</Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
