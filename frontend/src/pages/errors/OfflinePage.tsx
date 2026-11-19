import { Body, BottomActions, Screen } from '../../components/layout'
import { Button } from '../../components/ui'

export function OfflinePage() {
  return (
    <Screen>
      <Body className="flex-1 justify-center pb-16">
        <h1 className="m-0 text-[22px] font-bold">인터넷을 연결해 주세요</h1>
        <p className="m-0 text-base leading-relaxed text-ink-2">연결이 확인되면 다시 시도해 주세요.</p>
      </Body>
      <BottomActions>
        <Button onClick={() => window.location.reload()}>다시 시도</Button>
      </BottomActions>
    </Screen>
  )
}
