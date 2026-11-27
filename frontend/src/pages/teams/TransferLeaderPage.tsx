import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Notice } from '../../components/ui'
import { teamActions, userName } from '../../store'
import { useTeamContext } from '../../routes/hooks'

export function TransferLeaderPage() {
  const { s, team, me, leader } = useTeamContext()
  const navigate = useNavigate()
  const others = team ? team.memberIds.filter((id) => id !== me?.id) : []
  const [picked, setPicked] = useState<string | null>(null)

  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />
  if (!leader) return <Navigate to={`/teams/${team.id}`} replace />

  const selected = picked ?? others[0] ?? ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!selected || !team) return
    await teamActions.transferLeader(team.id, selected)
    navigate(`/teams/${team.id}/members`)
  }

  return (
    <Screen>
      <TopBar title="팀장 넘기기" back={{ to: `/teams/${team.id}/members` }} description="새 팀장이 될 팀원을 골라주세요." />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-sm font-medium text-ink-2">새 팀장</legend>
            {others.map((id) => (
              <label
                key={id}
                className={`flex min-h-12 items-center gap-3 rounded-control px-3.5 ${
                  selected === id ? 'border-2 border-accent bg-accent-soft' : 'border border-line-strong bg-surface'
                }`}
              >
                <input type="radio" name="leader" checked={selected === id} onChange={() => setPicked(id)} className="size-5 accent-accent" />
                <span>{userName(s, id)}</span>
              </label>
            ))}
          </fieldset>
          <Notice>넘기면 목표 작성, 완료 확인, 회의 시간 변경 같은 팀장 기능을 쓸 수 없어요.</Notice>
        </Body>
        <BottomActions>
          <Button type="submit" disabled={!selected}>
            팀장 넘기기
          </Button>
          <Button to={`/teams/${team.id}/members`} variant="ghost">
            취소
          </Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
