import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type ListRowProps = {
  label: string
  meta?: ReactNode
  chevron?: boolean
  className?: string
}

export function ListRow({ label, meta, chevron = false, className }: ListRowProps) {
  return (
    <div className={cn('flex min-h-14 items-center gap-3 px-4 py-3', className)}>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {meta ? (
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {meta}
        </span>
      ) : null}
      {chevron ? (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}
