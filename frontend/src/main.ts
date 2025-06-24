import { App } from '@/app'
import { CameraAPI } from '@/services/camera-api'
import { SessionAPI } from '@/services/session-api'

// Initialize APIs
const cameraAPI = new CameraAPI('/api/camera')
const sessionAPI = new SessionAPI('/api/sessions')

// Initialize and start the app
const app = new App({
  cameraAPI,
  sessionAPI
})

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init().catch(console.error)
})