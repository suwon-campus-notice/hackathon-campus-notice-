import { useNavigate } from 'react-router-dom'
import { Body, MainTabBar, Screen, TopBar } from '../../components/layout'
import { Button, Card } from '../../components/ui'
import { auth, currentUser, useAppState } from '../../store'

export function MyInfoPage() {
  const navigate = useNavigate()
  const user = currentUser(useAppState())
  if (!user) return null

  async function logout() {
    await auth.logout()
    navigate('/login')
  }

  const rows = [
    ['이름', user.name],
    ['아이디', user.loginId],
    ['학번', user.studentId],
  ]

  return (
    <Screen nav={<MainTabBar />}>
      <TopBar title="내 정보" />
      <Body>
        <div className="flex flex-col items-center gap-2 py-2">
          <div
            aria-hidden
            className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-2xl font-bold text-accent-ink"
          >
            {user.name.charAt(0)}
          </div>
          <div className="text-lg font-bold">{user.name}</div>
        </div>

        <Card className="py-1">
          <dl className="m-0">
            {rows.map(([label, value], i) => (
              <div key={label} className={`flex min-h-12 items-center justify-between ${i > 0 ? 'border-t border-line' : ''}`}>
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="m-0 text-[15px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="flex flex-col gap-2">
          <Button to="/me/password" variant="secondary">
            비밀번호 변경
          </Button>
          <Button variant="danger" onClick={logout}>
            로그아웃
          </Button>
        </div>
      </Body>
    </Screen>
  )
}
