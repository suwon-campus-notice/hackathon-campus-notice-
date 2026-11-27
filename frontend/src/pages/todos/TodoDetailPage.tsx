import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card, cx } from '../../components/ui'
import { formatDue } from '../../lib/format'
import { todoActions, userName } from '../../store'
import { useTeamContext } from '../../routes/hooks'
import { useParams } from 'react-router-dom'
import { TODO_STATUS_LABELS, type TodoStatus } from '../../types'

const STEPS: TodoStatus[] = ['doing', 'requested', 'done']

export function TodoDetailPage() {
  const { s, team, teamId, me, leader } = useTeamContext()
  const { todoId = '' } = useParams()
  const todo = s.todos.find((t) => t.id === todoId && t.teamId === teamId)
  const [draft, setDraft] = useState<string | null>(null)
  const back = `/teams/${teamId}/todos`

  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />
  const isAssignee = todo?.assigneeId === me.id
  if (!todo || (!isAssignee && !leader)) return <Navigate to={back} replace />

  const goal = s.goals.find((g) => g.id === todo.goalId)
  const current = STEPS.indexOf(todo.status)
  // 진행 중에는 담당자만, 확인 완료 후에는 담당자와 팀장이 수정 칸을 열 수 있다
  const editingDoing = todo.status === 'doing' && isAssignee
  const editingDone = todo.status === 'done' && draft !== null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!todo) return
    if (editingDoing) {
      // 수행 내용을 적고 완료 요청을 한 번에 보낸다
      await todoActions.requestDone(todo.id, (draft ?? todo.note).trim())
    } else if (editingDone) {
      await todoActions.saveNote(todo.id, (draft ?? '').trim())
      setDraft(null)
    }
  }

  const info: Array<[string, string]> = [
    ['큰 목표', goal?.title ?? ''],
    ['담당자', userName(s, todo.assigneeId)],
    ['마감일', formatDue(todo.due)],
  ]

  return (
    <Screen>
      <TopBar title={todo.title} back={{ to: back }} />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body className="flex-1">
          <Card>
            <dl className="m-0 flex flex-col gap-3">
              {info.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-[15px]">
                  <dt className="text-muted">{k}</dt>
                  <dd className="m-0 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <ol aria-label="진행 상태" className="m-0 flex list-none gap-2 p-0">
            {STEPS.map((st, i) => (
              <li key={st} aria-current={i === current ? 'step' : undefined} className="flex flex-1 flex-col gap-1.5">
                <span className={cx('h-1.5 rounded-full', i <= current ? 'bg-accent' : 'bg-line')} />
                <span className={cx('text-center text-[13px]', i === current ? 'font-bold text-accent-ink' : 'text-muted')}>
                  {TODO_STATUS_LABELS[st]}
                </span>
              </li>
            ))}
          </ol>

          <section aria-labelledby="note-title" className="flex flex-col gap-2">
            {editingDoing || editingDone ? (
              <>
                <label id="note-title" htmlFor="note" className="text-base font-bold">
                  수행 내용
                </label>
                <textarea
                  id="note"
                  rows={6}
                  value={draft ?? todo.note}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="한 일과 결과를 적어주세요."
                  className="w-full resize-y rounded-control border border-line-strong bg-surface p-3.5 text-base leading-relaxed text-ink"
                />
              </>
            ) : (
              <>
                <h2 id="note-title" className="m-0 text-base font-bold">
                  수행 내용
                </h2>
                <p className="m-0 min-h-14 whitespace-pre-wrap rounded-control border border-line bg-surface p-3.5 text-[15px] leading-relaxed text-ink-2">
                  {todo.note || '아직 적은 내용이 없어요.'}
                </p>
              </>
            )}
            {todo.status === 'done' && !editingDone && <p className="m-0 text-xs text-muted">확인이 끝난 뒤에도 수정할 수 있어요.</p>}
            {todo.status === 'requested' && !leader && <p className="m-0 text-sm text-muted">팀장이 확인하면 끝나요.</p>}
          </section>
        </Body>
        <BottomActions>
          {editingDoing && <Button type="submit">완료 요청</Button>}
          {todo.status === 'requested' && leader && (
            <Button onClick={() => todoActions.confirm(todo.id)}>확인 완료</Button>
          )}
          {todo.status === 'done' && !editingDone && (
            <Button variant="secondary" onClick={() => setDraft(todo.note)}>
              수정
            </Button>
          )}
          {editingDone && <Button type="submit">저장</Button>}
        </BottomActions>
      </form>
    </Screen>
  )
}
