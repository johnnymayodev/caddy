import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type ChipProps = {
  children: ReactNode
  variant?: 'outline' | 'filled'
  className?: string
}

export function Chip({ children, variant = 'outline', className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap',
        variant === 'filled'
          ? 'border-transparent bg-foreground text-background'
          : 'border-border bg-transparent text-foreground',
        className,
      )}
    >
      {children}
    </span>
  )
}
