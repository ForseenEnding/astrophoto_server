import { Camera, Circle, FolderOpen, Image, LayoutDashboard } from 'lucide-react'

type ViewType = 'dashboard' | 'camera' | 'calibration' | 'sessions' | 'gallery' | 'configuration'

interface NavigationProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function Navigation({ currentView, onViewChange }: NavigationProps) {
  const navItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'camera' as ViewType, label: 'Camera', icon: Camera },
    { id: 'calibration' as ViewType, label: 'Calibration', icon: Circle },
    { id: 'sessions' as ViewType, label: 'Sessions', icon: FolderOpen },
    { id: 'gallery' as ViewType, label: 'Gallery', icon: Image },
  ]

  return (
    <nav className="navigation">
      <ul className="nav-list">
        {navItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onViewChange(id)}
              className={`nav-item ${currentView === id ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}