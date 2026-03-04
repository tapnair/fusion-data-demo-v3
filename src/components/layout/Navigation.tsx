/**
 * Navigation Component
 * Secondary navigation component
 */

import { Link, useLocation } from 'react-router-dom'

interface NavLink {
  path: string
  label: string
}

interface NavigationProps {
  links: NavLink[]
}

export function Navigation({ links }: NavigationProps) {
  const location = useLocation()

  return (
    <nav className="navigation">
      {links.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={location.pathname === link.path ? 'active' : ''}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
