import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type PageHeaderProps = {
  title: string
  /**
   * `true` goes back in history, a string navigates to that path,
   * `undefined` shows no back button.
   */
  back?: boolean | string
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, back, actions, className }: PageHeaderProps) {
  const navigate = useNavigate()

  const backClassName = buttonVariants({
    variant: 'ghost',
    size: 'icon-lg',
    className: '-ml-2 size-11 shrink-0 rounded-full',
  })

  return (
    <header
      className={cn(
        'sticky top-0 z-10 flex min-h-14 items-center gap-2 border-b border-border bg-background px-4 pt-[env(safe-area-inset-top)]',
        className,
      )}
    >
      {back === true ? (
        <button
          type="button"
          aria-label="Go back"
          className={backClassName}
          onClick={() => {
            void navigate(-1)
          }}
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
      ) : null}
      {typeof back === 'string' ? (
        <Link to={back} aria-label="Go back" className={backClassName}>
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      ) : null}
      <h1 className="min-w-0 flex-1 truncate font-heading text-lg font-semibold tracking-tight">
        {title}
      </h1>
      {actions ? (
        <div className="flex shrink-0 items-center gap-1">{actions}</div>
      ) : null}
    </header>
  )
}
