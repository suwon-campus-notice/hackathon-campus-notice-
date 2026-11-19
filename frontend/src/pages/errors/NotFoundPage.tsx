import { Body, BottomActions, Screen } from '../../components/layout'
import { Button } from '../../components/ui'

export function NotFoundPage() {
  return (
    <Screen>
      <Body className="flex-1 justify-center pb-16">
        <h1 className="m-0 text-[22px] font-bold">페이지를 찾을 수 없어요</h1>
        <p className="m-0 text-base leading-relaxed text-ink-2">주소가 바뀌었거나 없는 페이지예요.</p>
      </Body>
      <BottomActions>
        <Button to="/teams">내 팀으로 가기</Button>
      </BottomActions>
    </Screen>
  )
}
