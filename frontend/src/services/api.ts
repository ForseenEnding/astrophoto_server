// API client for your FastAPI backend
class AstroAPI {
    private baseURL: string;
  
    constructor(baseURL: string = import.meta.env.VITE_API_BASE_URL || '') {
      this.baseURL = baseURL;
    }
  
    private async request<T>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<T> {
      const url = `${this.baseURL}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
  
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
  
      return response.json();
    }
  
    // Camera API methods
    camera = {
      getStatus: () => this.request('/api/camera/status'),
      connect: () => this.request('/api/camera/connect', { method: 'POST' }),
      disconnect: () => this.request('/api/camera/disconnect', { method: 'POST' }),
      capture: (data: any) => this.request('/api/camera/capture', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      preview: () => fetch(`${this.baseURL}/api/camera/preview`),
    };
  
    // Sessions API methods
    sessions = {
      list: () => this.request('/api/sessions/'),
      create: (data: any) => this.request('/api/sessions/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      get: (id: string) => this.request(`/api/sessions/${id}`),
      delete: (id: string) => this.request(`/api/sessions/${id}`, {
        method: 'DELETE',
      }),
    };
  }
  
  export const api = new AstroAPI();