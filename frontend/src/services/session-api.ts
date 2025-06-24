export interface Session {
    id: string
    name: string
    target: string
    created_at: string
    updated_at: string
    status: 'active' | 'paused' | 'completed'
    statistics: {
      total_captures: number
      successful_captures: number
      failed_captures: number
    }
  }
  
  export interface CreateSessionRequest {
    name: string
    target: string
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
  
    async activateSession(sessionId: string): Promise<{ message: string }> {
      const response = await fetch(`${this.baseUrl}/${sessionId}/activate`, {
        method: 'POST'
      })
      if (!response.ok) {
        throw new Error(`Failed to activate session: ${response.statusText}`)
      }
      return response.json()
    }
  }