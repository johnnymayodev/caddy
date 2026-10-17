import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type StepperProps = {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  className,
}: StepperProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <Button
        variant="outline"
        aria-label="Decrease"
        className="size-12 shrink-0 rounded-full"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-5" aria-hidden="true" />
      </Button>
      <span
        aria-live="polite"
        className="min-w-14 text-center text-3xl font-semibold tabular-nums"
      >
        {value}
      </span>
      <Button
        variant="outline"
        aria-label="Increase"
        className="size-12 shrink-0 rounded-full"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-5" aria-hidden="true" />
      </Button>
    </div>
  )
}
