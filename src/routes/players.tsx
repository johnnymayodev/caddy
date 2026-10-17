import { useDocumentTitle } from '@/app/use-document-title'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'

export function PlayersScreen() {
  useDocumentTitle('Players · Caddy')

  return (
    <>
      <PageHeader title="Players" back="/courses" />
      <EmptyState>
        Players you add will be available when you set up a round.
      </EmptyState>
    </>
  )
}
