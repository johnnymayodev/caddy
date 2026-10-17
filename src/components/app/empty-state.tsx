import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type EmptyStateProps = {
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ children, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 px-6 py-16 text-center',
        className,
      )}
    >
      <p className="max-w-64 text-sm text-balance text-muted-foreground">
        {children}
      </p>
      {action}
    </div>
  )
}
