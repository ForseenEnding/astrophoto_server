import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface CameraConfig {
  name: string
  type: string
  label?: string
  read_only: boolean
  value?: string
  choices: string[]
}

interface ConfigGroup {
  label: string
  description: string
  config_names: string[]
}

interface ConfigGroupsResponse {
  groups: Record<string, ConfigGroup>
  configs: Record<string, CameraConfig | null>
}

interface ConfigUpdateRequest {
  configs: Record<string, string>
}

class CameraConfigAPI {
  private baseUrl = '/api/camera/config'

  async getConfigGroups(): Promise<ConfigGroupsResponse> {
    const response = await fetch(`${this.baseUrl}/groups`)
    if (!response.ok) {
      throw new Error(`Failed to fetch config groups: ${response.statusText}`)
    }
    return response.json()
  }

  async updateConfigs(request: ConfigUpdateRequest): Promise<any> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      throw new Error(`Failed to update configs: ${response.statusText}`)
    }
    return response.json()
  }
}

const configAPI = new CameraConfigAPI()

export function useCameraConfigGroups() {
  return useQuery<ConfigGroupsResponse>({
    queryKey: ['camera', 'config', 'groups'],
    queryFn: () => configAPI.getConfigGroups(),
    refetchOnWindowFocus: false,
  })
}

export function useUpdateCameraConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: ConfigUpdateRequest) => configAPI.updateConfigs(request),
    onSuccess: () => {
      // Refresh the config groups after update
      queryClient.invalidateQueries({ queryKey: ['camera', 'config', 'groups'] })
    },
  })
}