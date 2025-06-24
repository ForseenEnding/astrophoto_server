import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

interface CameraPreset {
  name: string
  label: string
  description?: string
  created_at: string
  configs: Record<string, any>
}

interface CreatePresetRequest {
  name: string
  label: string
  description?: string
}

interface PresetListResponse {
  presets: CameraPreset[]
}

interface ApplyPresetResponse {
  success: boolean
  applied_configs: string[]
  message: string
}

class CameraPresetAPI {
  private baseUrl = '/api/presets/'

  async listPresets(): Promise<PresetListResponse> {
    const response = await fetch(this.baseUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch presets: ${response.statusText}`)
    }
    return response.json()
  }

  async savePreset(request: CreatePresetRequest): Promise<CameraPreset> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to save preset: ${response.statusText}`)
    }
    return response.json()
  }

  async getPreset(name: string): Promise<CameraPreset> {
    const response = await fetch(`${this.baseUrl}/${name}`)
    if (!response.ok) {
      throw new Error(`Failed to get preset: ${response.statusText}`)
    }
    return response.json()
  }

  async applyPreset(name: string): Promise<ApplyPresetResponse> {
    const response = await fetch(`${this.baseUrl}/${name}/apply`, {
      method: 'PUT'
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.detail || `Failed to apply preset: ${response.statusText}`)
    }
    return response.json()
  }

  async deletePreset(name: string): Promise<{ message: string }> {
    const response = await fetch(`${this.baseUrl}/${name}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`Failed to delete preset: ${response.statusText}`)
    }
    return response.json()
  }
}

const presetAPI = new CameraPresetAPI()

export function useCameraPresets() {
  return useQuery<PresetListResponse>({
    queryKey: ['camera', 'presets'],
    queryFn: () => presetAPI.listPresets(),
    refetchOnWindowFocus: false,
  })
}

export function useSavePreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CreatePresetRequest) => presetAPI.savePreset(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera', 'presets'] })
    },
  })
}

export function useApplyPreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => presetAPI.applyPreset(name),
    onSuccess: () => {
      // Refresh camera config after applying preset
      queryClient.invalidateQueries({ queryKey: ['camera', 'config'] })
    },
  })
}

export function useDeletePreset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => presetAPI.deletePreset(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['camera', 'presets'] })
    },
  })
}

export function useGetPreset(name: string) {
  return useQuery<CameraPreset>({
    queryKey: ['camera', 'presets', name],
    queryFn: () => presetAPI.getPreset(name),
    enabled: !!name,
  })
}