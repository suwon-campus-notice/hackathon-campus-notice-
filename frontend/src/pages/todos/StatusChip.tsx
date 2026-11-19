import { Chip, type ChipTone } from '../../components/ui'
import { TODO_STATUS_LABELS, type TodoStatus } from '../../types'

const TONES: Record<TodoStatus, ChipTone> = { doing: 'accent', requested: 'warn', done: 'solid' }

/** 할 일 상태 표시 (글자로도 구분되도록 상태 이름을 항상 적는다) */
export function StatusChip({ status }: { status: TodoStatus }) {
  return <Chip tone={TONES[status]}>{TODO_STATUS_LABELS[status]}</Chip>
}
