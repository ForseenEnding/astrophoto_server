import { useState } from 'react'
import { CameraConfiguration } from './components/CameraConfiguration'
import { CameraControl } from './components/CameraControl'
import { ImageGallery } from './components/ImageGallery'
import { Navigation } from './components/Navigation'
import { NavigationStatusBar } from './components/NavigationStatusBar'
import { NightVisionToggle } from './components/NightVisionToggle'
import { SessionManager } from './components/SessionManager'

type ViewType = 'dashboard' | 'camera' | 'calibration' | 'sessions' | 'gallery' | 'configuration'

export function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')

  const renderCurrentView = () => {
    switch (currentView) {
      case 'camera':
        return (
          <div className="full-screen-view">
            <CameraControl />
          </div>
        )
      case 'configuration':
        return (
          <div className="full-screen-view">
            <CameraConfiguration />
          </div>
        )
      case 'sessions':
        return (
          <div className="full-screen-view">
            <SessionManager />
          </div>
        )
      case 'gallery':
        return (
          <div className="full-screen-view">
            <ImageGallery />
          </div>
        )
      case 'dashboard':
      default:
        return (
          <div className="dashboard">
            <div className="dashboard-grid">
              <div className="dashboard-section">
                <CameraControl compact />
              </div>
              <div className="dashboard-section">
                <SessionManager compact />
              </div>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Astrophotography Control</h1>
        <NavigationStatusBar />
        <div className="header-controls">
          <Navigation currentView={currentView} onViewChange={setCurrentView} />
          <NightVisionToggle />
        </div>
      </header>
      
      <main className="app-main">
        {renderCurrentView()}
      </main>
    </div>
  )
}