import { Link } from 'react-router'
import { useDocumentTitle } from '@/app/use-document-title'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'
import { buttonVariants } from '@/components/ui/button'

export function PlayScreen() {
  useDocumentTitle('Play · Caddy')

  return (
    <>
      <PageHeader title="Play" />
      <EmptyState
        action={
          <Link
            to="/rounds/new"
            className={buttonVariants({ className: 'h-11 px-4' })}
          >
            Start a round
          </Link>
        }
      >
        No round in progress — start one to keep score as you play.
      </EmptyState>
    </>
  )
}
