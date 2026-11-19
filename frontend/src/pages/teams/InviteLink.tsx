import { useState } from 'react'
import { Button } from '../../components/ui'

/** 링크를 클립보드에 복사하는 버튼. 복사하면 잠깐 "복사했어요"로 바뀐다. */
export function CopyLinkButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드를 쓸 수 없으면 아무 표시도 하지 않는다
    }
  }

  return (
    <Button variant="secondary" onClick={copy}>
      <span aria-live="polite">{copied ? '복사했어요' : '링크 복사'}</span>
    </Button>
  )
}

/** 사람 이름의 첫 글자를 담은 동그라미 */
export function Avatar({ name, solid }: { name: string; solid?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        solid ? 'bg-accent text-white' : 'bg-soft text-ink-2'
      }`}
    >
      {name.slice(0, 1)}
    </span>
  )
}
