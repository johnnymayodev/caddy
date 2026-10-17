import { useParams } from 'react-router'
import { useDocumentTitle } from '@/app/use-document-title'
import { PageHeader } from '@/components/app/page-header'

export function RoundScreen() {
  const { id } = useParams()

  useDocumentTitle(id ? `Round ${id} · Caddy` : 'Round · Caddy')

  return (
    <>
      <PageHeader title={id ? `Round ${id}` : 'Round'} back="/history" />
      <p className="px-4 py-6 text-sm text-muted-foreground">
        Hole-by-hole scoring for this round will show up here.
      </p>
    </>
  )
}
