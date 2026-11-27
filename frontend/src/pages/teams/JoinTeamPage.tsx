import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card } from '../../components/ui'
import type { Team } from '../../types'
import { teamActions, useAppState, userName } from '../../store'

export function JoinTeamPage() {
  const { code = '' } = useParams()
  const s = useAppState()
  const navigate = useNavigate()
  // 어느 코드에 대한 조회 결과인지 함께 들고 있어서, 코드가 바뀌면 다시 "찾는 중"이 된다
  const [lookup, setLookup] = useState<{ code: string; result: { team: Team; expired: boolean } | null } | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    let cancelled = false
    teamActions.findByInvite(code).then((result) => {
      if (!cancelled) setLookup({ code, result })
    })
    return () => {
      cancelled = true
    }
  }, [code])

  // undefined: 찾는 중, null: 없는 링크
  const found = lookup?.code === code ? lookup.result : undefined

  if (found === undefined) {
    return (
      <Screen>
        <TopBar title="초대 링크를 확인하고 있어요" />
      </Screen>
    )
  }

  if (!found) {
    return (
      <Screen>
        <TopBar title="초대 링크를 찾을 수 없어요" back={{ to: '/teams' }} description="링크가 올바른지 확인하거나 팀장에게 새 링크를 요청해 주세요." />
        <BottomActions>
          <Button to="/teams">내 팀으로 가기</Button>
        </BottomActions>
      </Screen>
    )
  }

  if (found.expired) {
    return (
      <Screen>
        <TopBar
          title="만료된 초대 링크예요"
          back={{ to: '/teams' }}
          description="초대 링크는 만든 지 7일이 지나면 사용할 수 없어요. 팀장에게 새 링크를 보내 달라고 요청해 주세요."
        />
        <BottomActions>
          <Button to="/teams">내 팀으로 가기</Button>
        </BottomActions>
      </Screen>
    )
  }

  const { team } = found

  async function join() {
    setJoining(true)
    // 이미 팀원이어도 서버가 그대로 팀을 돌려준다
    const joined = await teamActions.join(code)
    setJoining(false)
    if (joined) navigate(`/teams/${team.id}`)
  }

  return (
    <Screen>
      <TopBar title="팀에 초대받았어요" back={{ to: '/teams' }} description="참여하면 이 팀의 일정과 할 일을 함께 볼 수 있어요." />
      <Body>
        <Card className="flex flex-col gap-3">
          <span className="text-lg font-bold">{team.name}</span>
          <dl className="m-0 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">팀장</dt>
              <dd className="m-0 font-medium">{userName(s, team.leaderId)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">현재 팀원</dt>
              <dd className="m-0 font-medium">{team.memberIds.length}명</dd>
            </div>
          </dl>
        </Card>
      </Body>
      <BottomActions>
        <Button onClick={join} disabled={joining}>
          팀에 참여하기
        </Button>
        <Button to="/teams" variant="ghost">
          취소
        </Button>
      </BottomActions>
    </Screen>
  )
}
