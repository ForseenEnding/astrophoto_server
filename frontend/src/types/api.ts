export interface CameraStatusResponse {
  connected: boolean;
  model: string;
  battery: string;
}

export interface Session {
  id: string;
  name: string;
  target: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'paused' | 'completed';
  statistics: {
    total_captures: number;
    successful_captures: number;
  };
}

export interface SessionListResponse {
  sessions: Session[];
  active_session_id: string | null;
}