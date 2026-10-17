import { Link } from 'react-router'
import { useDocumentTitle } from '@/app/use-document-title'
import { ListRow } from '@/components/app/list-row'
import { PageHeader } from '@/components/app/page-header'

export function CoursesScreen() {
  useDocumentTitle('Courses · Caddy')

  return (
    <>
      <PageHeader title="Courses" />
      <ul className="divide-y divide-border border-b border-border">
        <li>
          <Link to="/courses/new" className="block active:bg-muted">
            <ListRow label="Add a course" chevron />
          </Link>
        </li>
        <li>
          <Link to="/players" className="block active:bg-muted">
            <ListRow label="Players" meta="Add and manage" chevron />
          </Link>
        </li>
      </ul>
      <p className="px-4 py-4 text-sm text-muted-foreground">
        Courses you add appear here, with their hole pars and distances.
      </p>
    </>
  )
}
