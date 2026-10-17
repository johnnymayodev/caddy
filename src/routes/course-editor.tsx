import { useParams } from 'react-router'
import { useDocumentTitle } from '@/app/use-document-title'
import { PageHeader } from '@/components/app/page-header'

export function CourseEditorScreen() {
  const { id } = useParams()
  const isNew = id === undefined

  useDocumentTitle(isNew ? 'New course · Caddy' : 'Edit course · Caddy')

  return (
    <>
      <PageHeader
        title={isNew ? 'New course' : 'Edit course'}
        back="/courses"
      />
      <p className="px-4 py-6 text-sm text-muted-foreground">
        {isNew
          ? 'Name the course, then add each hole with its par and distance.'
          : `Hole details for course ${id} will be edited here.`}
      </p>
    </>
  )
}
