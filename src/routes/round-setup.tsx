import { useDocumentTitle } from '@/app/use-document-title'
import { PageHeader } from '@/components/app/page-header'

export function RoundSetupScreen() {
  useDocumentTitle('New round · Caddy')

  return (
    <>
      <PageHeader title="New round" back="/" />
      <p className="px-4 py-6 text-sm text-muted-foreground">
        Pick a course and players, then set the hole count to start scoring.
      </p>
    </>
  )
}
