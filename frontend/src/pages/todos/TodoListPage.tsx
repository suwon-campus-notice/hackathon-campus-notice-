import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TeamTabBar, TopBar } from '../../components/layout'
import { Button, cx } from '../../components/ui'
import { formatDue } from '../../lib/format'
import { userName, visibleTodos } from '../../store'
import { useTeamContext } from '../../routes/hooks'
import { StatusChip } from './StatusChip'

type Filter = 'all' | 'mine'

export function TodoListPage() {
  const { s, team, teamId, me, leader } = useTeamContext()
  const [filter, setFilter] = useState<Filter>('all')
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />

  const base = `/teams/${team.id}/todos`
  const todos = visibleTodos(s, teamId).filter((t) => !leader || filter === 'all' || t.assigneeId === me.id)
  const goals = s.goals
    .filter((g) => g.teamId === teamId)
    .map((g) => ({ goal: g, items: todos.filter((t) => t.goalId === g.id) }))
    // 팀장은 빈 목표까지 모두, 팀원은 할 일이 있는 목표만. 팀장이 '내 할 일'로 거르면 해당 할 일이 있는 목표만
    .filter((x) => x.items.length > 0 || (leader && filter === 'all'))

  return (
    <Screen nav={<TeamTabBar teamId={team.id} />}>
      <TopBar title={leader ? '할 일' : '내 할 일'} description={leader ? undefined : '내가 맡은 할 일만 보여요.'} />
      {leader && (
        <div className="px-4 pt-1">
          <div className="flex gap-1 rounded-control bg-soft p-1">
            {(['all', 'mine'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  'min-h-11 flex-1 rounded-[9px] text-sm',
                  filter === f ? 'bg-surface font-bold text-ink shadow-sm' : 'font-medium text-muted',
                )}
              >
                {f === 'all' ? '전체' : '내 할 일'}
              </button>
            ))}
          </div>
        </div>
      )}
      <Body className="flex-1">
        {goals.length === 0 && !leader && (
          <p className="m-0 flex flex-1 items-center justify-center text-base text-muted">할 일이 없어요</p>
        )}
        {goals.map(({ goal, items }) => {
          const done = s.todos.filter((t) => t.goalId === goal.id && t.status === 'done').length
          const total = s.todos.filter((t) => t.goalId === goal.id).length
          return (
            <section key={goal.id} aria-labelledby={`goal-${goal.id}`} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <h2 id={`goal-${goal.id}`} className="m-0 flex-1 text-base font-bold">
                  {goal.title}
                </h2>
                {leader && (
                  <>
                    <span className="text-xs text-muted">
                      {done}/{total} 확인 완료
                    </span>
                    <Link
                      to={`${base}/goals/${goal.id}/edit`}
                      aria-label={`${goal.title} 수정`}
                      className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-accent no-underline"
                    >
                      수정
                    </Link>
                  </>
                )}
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`${base}/${t.id}`}
                      className="flex min-h-14 items-center gap-3 rounded-card border border-line bg-surface p-3.5 text-ink no-underline"
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="text-[15px] font-medium">{t.title}</span>
                        <span className="text-[13px] text-muted">
                          {t.assigneeId === me.id ? '나' : userName(s, t.assigneeId)} · 마감 {formatDue(t.due)}
                        </span>
                      </span>
                      <StatusChip status={t.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </Body>
      {leader && (
        <BottomActions>
          <Button to={`${base}/goals/new`}>목표 추가</Button>
        </BottomActions>
      )}
    </Screen>
  )
}
