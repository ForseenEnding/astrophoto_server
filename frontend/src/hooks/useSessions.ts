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

  // Mutation for deleting session
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => sessionAPI.deleteSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // Mutation for updating session
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, updates }: { sessionId: string; updates: Partial<Session> }) =>
      sessionAPI.updateSession(sessionId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  // Mutation for deactivating active session
  const deactivateSessionMutation = useMutation({
    mutationFn: () => sessionAPI.deactivateSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })

  return {
    sessions: sessionData?.sessions || [],
    activeSessionId: sessionData?.active_session_id,
    isLoading,
    error,
    
    // Session actions
    createSession: createSessionMutation.mutate,
    activateSession: activateSessionMutation.mutate,
    deleteSession: deleteSessionMutation.mutate,
    updateSession: updateSessionMutation.mutate,
    deactivateSession: deactivateSessionMutation.mutate,
    
    // Mutation objects for advanced handling
    createSessionMutation,
    activateSessionMutation,
    deleteSessionMutation,
    updateSessionMutation,
    deactivateSessionMutation,
    
    // Loading states
    isCreating: createSessionMutation.isPending,
    isActivating: activateSessionMutation.isPending,
    isDeleting: deleteSessionMutation.isPending,
    isUpdating: updateSessionMutation.isPending,
    isDeactivating: deactivateSessionMutation.isPending,
    
    // Error states
    createError: createSessionMutation.error,
    activateError: activateSessionMutation.error,
    deleteError: deleteSessionMutation.error,
    updateError: updateSessionMutation.error,
    deactivateError: deactivateSessionMutation.error,
  }
}

export function useSession(sessionId: string) {
  return useQuery<Session>({
    queryKey: ['sessions', sessionId],
    queryFn: () => sessionAPI.getSession(sessionId),
    enabled: !!sessionId,
  })
}

export function useSessionImages(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'images'],
    queryFn: () => sessionAPI.getSessionImages(sessionId),
    enabled: !!sessionId,
  })
}

export function useSessionStats(sessionId: string) {
  return useQuery({
    queryKey: ['sessions', sessionId, 'stats'],
    queryFn: () => sessionAPI.getSessionStats(sessionId),
    enabled: !!sessionId,
  })
}