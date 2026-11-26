import { Navigate } from 'react-router-dom'
import { Body, Screen, TeamTabBar, TopBar } from '../../components/layout'
import { Button } from '../../components/ui'
import { teamActions, userName } from '../../store'
import { useTeamContext } from '../../routes/hooks'
import { Avatar, CopyLinkButton } from './InviteLink'
import { inviteUrl } from './inviteUrl'

export function MembersPage() {
  const { s, team, me, leader } = useTeamContext()
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />

  const base = `/teams/${team.id}/members`
  const url = inviteUrl(team.inviteCode)

  function tag(id: string): string {
    if (id === team!.leaderId) return id === me!.id ? '팀장 · 나' : '팀장'
    return id === me!.id ? '나' : ''
  }

  return (
    <Screen nav={<TeamTabBar teamId={team.id} />}>
      <TopBar title={team.name} />
      <Body>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-bold">멤버 {team.memberIds.length}명</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {team.memberIds.map((id) => (
              <li key={id} className="flex min-h-12 items-center gap-3 rounded-card border border-line bg-surface px-3 py-2">
                <Avatar name={userName(s, id)} solid={id === team.leaderId} />
                <span className="flex-1 font-medium">{userName(s, id)}</span>
                <span className="text-sm text-muted">{tag(id)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-bold">초대 링크</h2>
          <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
            <span className="break-all text-sm font-medium text-accent-ink">{url}</span>
            <span className="text-xs text-muted">
              {team.inviteDaysLeft > 0 ? `${team.inviteDaysLeft}일 뒤에 만료돼요.` : '만료된 링크예요.'}
            </span>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-32 flex-1">
                <CopyLinkButton text={url} />
              </div>
              {leader && (
                <div className="min-w-32 flex-1">
                  <Button variant="secondary" onClick={() => teamActions.renewInvite(team.id)}>
                    새 링크 만들기
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-1 pb-4">
          <h2 className="m-0 text-base font-bold">팀 관리</h2>
          {leader && (
            <Button to={`${base}/transfer`} variant="ghost" className="justify-start">
              팀장 넘기기
            </Button>
          )}
          <Button to={`${base}/leave`} variant="danger" className="justify-start">
            팀 탈퇴
          </Button>
          {leader && <span className="text-xs text-muted">팀장은 팀장을 먼저 넘긴 뒤에 탈퇴할 수 있어요.</span>}
        </section>
      </Body>
    </Screen>
  )
}
