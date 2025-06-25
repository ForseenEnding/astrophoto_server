export interface Session {
  id: string
  name: string
  target: string
  created_at: string
  updated_at: string
  status: 'active' | 'paused' | 'completed'
  capture_plan?: {
    target_count: number
    exposure_time: string
    filter: string
  }
  statistics: {
    total_captures: number
    successful_captures: number
    failed_captures: number
    total_exposure_time: string
    average_focus_score?: number
  }
  images?: Array<{
    filename: string
    captured_at: string
    size_bytes?: number
    focus_score?: number
    preview_path?: string
  }>
}

export interface CreateSessionRequest {
  name: string
  target: string
  capture_plan?: {
    target_count: number
    exposure_time: string
    filter: string
  }
}

export interface SessionListResponse {
  sessions: Session[]
  active_session_id?: string
}

export class SessionAPI {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async listSessions(): Promise<SessionListResponse> {
    const response = await fetch(`${this.baseUrl}/`)
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`)
    }
    return response.json()
  }

  async createSession(request: CreateSessionRequest): Promise<{ session: Session; message: string }> {
    const response = await fetch(`${this.baseUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`)
    }
    return response.json()
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`)
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`)
    }
    return response.json()
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })
    if (!response.ok) {
      throw new Error(`Failed to update session: ${response.statusText}`)
    }
    return response.json()
  }

  async deleteSession(sessionId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${sessionId}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`Failed to delete session: ${response.statusText}`)
    }
    return response.json()
  }

  async activateSession(sessionId: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/activate`, {
      method: 'POST'
    })
    if (!response.ok) {
      throw new Error(`Failed to activate session: ${response.statusText}`)
    }
    return response.json()
  }

  async deactivateSession(): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/deactivate`, {
      method: 'POST'
    })
    if (!response.ok) {
      throw new Error(`Failed to deactivate session: ${response.statusText}`)
    }
    return response.json()
  }

  async captureToSession(sessionId: string, imageName?: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ image_name: imageName })
    })
    if (!response.ok) {
      throw new Error(`Failed to capture to session: ${response.statusText}`)
    }
    return response.json()
  }

  async getSessionImages(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/images`)
    if (!response.ok) {
      throw new Error(`Failed to get session images: ${response.statusText}`)
    }
    return response.json()
  }

  async getSessionStats(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/${sessionId}/stats`)
    if (!response.ok) {
      throw new Error(`Failed to get session stats: ${response.statusText}`)
    }
    return response.json()
  }
}