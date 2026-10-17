import { useEffect } from 'react'
import { Flag, History, Play } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', label: 'Play', icon: Play, end: true },
  { to: '/history', label: 'History', icon: History, end: false },
  { to: '/courses', label: 'Courses', icon: Flag, end: false },
] as const

export function Shell() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background text-foreground">
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <nav
        aria-label="Primary"
        className="sticky bottom-0 z-10 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-3">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] tracking-wide active:bg-muted',
                    isActive
                      ? 'font-semibold text-foreground'
                      : 'font-normal text-muted-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-12 items-center justify-center rounded-full',
                        isActive && 'bg-foreground text-background',
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
