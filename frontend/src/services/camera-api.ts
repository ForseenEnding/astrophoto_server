export interface CameraStatus {
    connected: boolean
    model?: string
    battery?: string
  }
  
  export interface CaptureRequest {
    save_to_path: string
    image_name?: string
  }
  
  export interface CaptureResponse {
    status: string
    filename: string
    timestamp: string
    size_bytes?: number
    static_url?: string
  }
  
  export class CameraAPI {
    private baseUrl: string
  
    constructor(baseUrl: string) {
      this.baseUrl = baseUrl
    }
  
    async getStatus(): Promise<CameraStatus> {
      const response = await fetch(`${this.baseUrl}/status`)
      if (!response.ok) {
        throw new Error(`Failed to get camera status: ${response.statusText}`)
      }
      return response.json()
    }
  
    async connect(): Promise<{ status: string; message: string }> {
      const response = await fetch(`${this.baseUrl}/connect`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Failed to connect camera: ${response.statusText}`)
      }
      return response.json()
    }
  
    async disconnect(): Promise<{ status: string; message: string }> {
      const response = await fetch(`${this.baseUrl}/disconnect`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Failed to disconnect camera: ${response.statusText}`)
      }
      return response.json()
    }
  
    async capture(request: CaptureRequest): Promise<CaptureResponse> {
      const response = await fetch(`${this.baseUrl}/capture`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      })
      if (!response.ok) {
        throw new Error(`Failed to capture image: ${response.statusText}`)
      }
      return response.json()
    }
  
    async getPreview(): Promise<Blob> {
      const response = await fetch(`${this.baseUrl}/preview`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Failed to get preview: ${response.statusText}`)
      }
      return response.blob()
    }
  }