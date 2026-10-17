import type { RouteObject } from 'react-router'
import { redirect } from 'react-router'
import { Shell } from './shell'
import { CourseEditorScreen } from '@/routes/course-editor'
import { CoursesScreen } from '@/routes/courses'
import { HistoryScreen } from '@/routes/history'
import { PlayScreen } from '@/routes/play'
import { PlayersScreen } from '@/routes/players'
import { RoundScreen } from '@/routes/round'
import { RoundSetupScreen } from '@/routes/round-setup'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <PlayScreen /> },
      { path: 'history', element: <HistoryScreen /> },
      { path: 'courses', element: <CoursesScreen /> },
      { path: 'courses/new', element: <CourseEditorScreen /> },
      { path: 'courses/:id', element: <CourseEditorScreen /> },
      { path: 'players', element: <PlayersScreen /> },
      { path: 'rounds/new', element: <RoundSetupScreen /> },
      { path: 'rounds/:id', element: <RoundScreen /> },
      { path: '*', loader: () => redirect('/') },
    ],
  },
]
