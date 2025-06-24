import { CameraAPI } from '@/services/camera-api'
import { SessionAPI } from '@/services/session-api'

interface AppConfig {
  cameraAPI: CameraAPI
  sessionAPI: SessionAPI
}

export class App {
  private cameraAPI: CameraAPI
  private sessionAPI: SessionAPI
  private mainContent: HTMLElement

  constructor(config: AppConfig) {
    this.cameraAPI = config.cameraAPI
    this.sessionAPI = config.sessionAPI
    this.mainContent = document.getElementById('main-content')!
  }

  async init(): Promise<void> {
    console.log('Initializing Astrophotography Control App...')
    
    // Load initial content
    await this.loadDashboard()
    
    // Set up navigation or other initialization
    this.setupEventListeners()
  }

  private async loadDashboard(): Promise<void> {
    this.mainContent.innerHTML = `
      <div class="dashboard">
        <h2>Dashboard</h2>
        <div id="camera-status">Loading camera status...</div>
        <div id="session-list">Loading sessions...</div>
      </div>
    `

    // Load camera status
    try {
      const status = await this.cameraAPI.getStatus()
      const statusElement = document.getElementById('camera-status')!
      statusElement.innerHTML = `
        <p>Camera: ${status.connected ? 'Connected' : 'Disconnected'}</p>
        ${status.model ? `<p>Model: ${status.model}</p>` : ''}
        ${status.battery ? `<p>Battery: ${status.battery}</p>` : ''}
      `
    } catch (error) {
      console.error('Failed to load camera status:', error)
    }
  }

  private setupEventListeners(): void {
    // Add any global event listeners here
    console.log('Event listeners set up')
  }
}