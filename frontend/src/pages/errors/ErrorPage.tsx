import { Body, BottomActions, Screen } from '../../components/layout'
import { Button } from '../../components/ui'

export function ErrorPage() {
  return (
    <Screen>
      <Body className="flex-1 justify-center pb-16">
        <h1 className="m-0 text-[22px] font-bold">문제가 생겼어요</h1>
        <p className="m-0 text-base leading-relaxed text-ink-2">내용을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      </Body>
      <BottomActions>
        <Button onClick={() => window.location.reload()}>다시 시도</Button>
        <Button to="/teams" variant="secondary">
          내 팀으로 가기
        </Button>
      </BottomActions>
    </Screen>
  )
}
