import { CreateSessionRequest, Session, SessionAPI, SessionListResponse } from '@/services/session-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const sessionAPI = new SessionAPI('/api/sessions')

export function useSessions() {
  const queryClient = useQueryClient()

  // Query for all sessions
  const {
    data: sessionData,
    isLoading,
    error,
  } = useQuery<SessionListResponse>({
    queryKey: ['sessions'],
    queryFn: () => sessionAPI.listSessions(),
  })

  // Mutation for creating new session
  const createSessionMutation = useMutation({
    mutationFn: (request: CreateSessionRequest) => sessionAPI.createSession(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // Mutation for activating session
  const activateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionAPI.activateSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return {
    sessions: sessionData?.sessions || [],
    activeSessionId: sessionData?.active_session_id,
    isLoading,
    error,
    createSession: createSessionMutation.mutate,
    activateSession: activateSessionMutation.mutate,
    isCreating: createSessionMutation.isPending,
    isActivating: activateSessionMutation.isPending,
    createError: createSessionMutation.error,
  }
}

export function useSession(sessionId: string) {
  return useQuery<Session>({
    queryKey: ['sessions', sessionId],
    queryFn: () => sessionAPI.getSession(sessionId),
    enabled: !!sessionId,
  })
}