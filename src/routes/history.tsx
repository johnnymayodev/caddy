import { useDocumentTitle } from '@/app/use-document-title'
import { EmptyState } from '@/components/app/empty-state'
import { PageHeader } from '@/components/app/page-header'

export function HistoryScreen() {
  useDocumentTitle('History · Caddy')

  return (
    <>
      <PageHeader title="History" />
      <EmptyState>Finished rounds will be listed here.</EmptyState>
    </>
  )
}
