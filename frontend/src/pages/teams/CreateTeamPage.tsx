import { useState, type FormEvent } from 'react'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card, TextField } from '../../components/ui'
import { teamActions } from '../../store'
import type { Team } from '../../types'
import { CopyLinkButton } from './InviteLink'
import { inviteUrl } from './inviteUrl'

export function CreateTeamPage() {
  const [name, setName] = useState('')
  const [created, setCreated] = useState<Team | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const team = await teamActions.create(name)
    if (team) setCreated(team)
  }

  if (created) {
    return (
      <Screen>
        <TopBar title="팀을 만들었어요" description={`${created.name}에 팀원을 초대해 보세요. 아래 링크를 보내면 돼요.`} />
        <Body>
          <Card className="flex flex-col gap-2">
            <span className="text-sm font-medium text-ink-2">초대 링크</span>
            <span className="break-all text-base font-medium text-accent-ink">{inviteUrl(created.inviteCode)}</span>
            <CopyLinkButton text={inviteUrl(created.inviteCode)} />
            <span className="text-xs text-muted">링크는 7일 뒤에 만료돼요.</span>
          </Card>
        </Body>
        <BottomActions>
          <Button to={`/teams/${created.id}`}>팀으로 가기</Button>
        </BottomActions>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar
        title="팀 만들기"
        back={{ to: '/teams' }}
        description="만든 사람이 팀장이 돼요. 팀장은 나중에 다른 팀원에게 넘길 수 있어요."
      />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          <TextField label="팀 이름" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Body>
        <BottomActions>
          <Button type="submit" disabled={!name.trim()}>
            팀 만들기
          </Button>
        </BottomActions>
      </form>
    </Screen>
  )
}
