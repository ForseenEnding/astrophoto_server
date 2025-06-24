import { CameraAPI, CameraStatus } from '@/services/camera-api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const cameraAPI = new CameraAPI('/api/camera')

export function useCameraStatus() {
  const queryClient = useQueryClient()

  // Query for camera status with auto-refresh
  const {
    data: status,
    isLoading,
    error,
  } = useQuery<CameraStatus>({
    queryKey: ['camera', 'status'],
    queryFn: () => cameraAPI.getStatus(),
    refetchInterval: 3000, // Refresh every 3 seconds
    refetchIntervalInBackground: true,
  })

  // Mutation for connecting camera
  const connectMutation = useMutation({
    mutationFn: () => cameraAPI.connect(),
    onSuccess: () => {
      // Immediately refresh status
      queryClient.invalidateQueries({ queryKey: ['camera', 'status'] })
    },
  })

  // Mutation for disconnecting camera
  const disconnectMutation = useMutation({
    mutationFn: () => cameraAPI.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera', 'status'] })
    },
  })

  // Mutation for capturing image
  const captureMutation = useMutation({
    mutationFn: (request: { save_to_path: string; image_name?: string }) =>
      cameraAPI.capture(request),
  })

  return {
    status: status || { connected: false },
    isLoading,
    error,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    capture: captureMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isCapturing: captureMutation.isPending,
    connectError: connectMutation.error,
    captureError: captureMutation.error,
  }
}