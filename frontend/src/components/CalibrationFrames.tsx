import {
  Camera,
  Circle,
  Clock,
  FolderOpen,
  Moon,
  Pause,
  Play,
  Settings,
  Square,
  Sun,
  Thermometer,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

// Types
enum CalibrationFrameType {
  DARK = 'dark',
  BIAS = 'bias', 
  FLAT = 'flat',
  FLAT_DARK = 'flat_dark'
}

interface CalibrationRequest {
  frame_type: CalibrationFrameType
  count: number
  session_id?: string
  exposure_time?: string
  iso?: string
  temperature_target?: number
  target_adu?: number
  base_name?: string
  save_path?: string
  interval_seconds: number
  delay_before_start: number
}

interface CalibrationJobStatus {
  job_id: string
  frame_type: CalibrationFrameType
  status: string
  progress: any
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  error_message?: string
  total_frames: number
  completed_frames: number
  failed_frames: number
  current_exposure?: string
  current_temperature?: number
  average_adu?: number
  output_directory: string
  captured_files: string[]
  session_id?: string
}

// API Service
class CalibrationAPI {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async startCalibration(request: CalibrationRequest) {
    const response = await fetch(`${this.baseUrl}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
    if (!response.ok) {
      throw new Error(`Failed to start calibration: ${response.statusText}`)
    }
    return response.json()
  }

  async getStatus(jobId: string): Promise<CalibrationJobStatus> {
    const response = await fetch(`${this.baseUrl}/${jobId}/status`)
    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`)
    }
    return response.json()
  }

  async pauseJob(jobId: string) {
    const response = await fetch(`${this.baseUrl}/${jobId}/pause`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to pause job: ${response.statusText}`)
    }
    return response.json()
  }

  async resumeJob(jobId: string) {
    const response = await fetch(`${this.baseUrl}/${jobId}/resume`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to resume job: ${response.statusText}`)
    }
    return response.json()
  }

  async cancelJob(jobId: string) {
    const response = await fetch(`${this.baseUrl}/${jobId}/cancel`, { method: 'POST' })
    if (!response.ok) {
      throw new Error(`Failed to cancel job: ${response.statusText}`)
    }
    return response.json()
  }

  async getPresets() {
    const response = await fetch(`${this.baseUrl}/presets`)
    if (!response.ok) {
      throw new Error(`Failed to get presets: ${response.statusText}`)
    }
    return response.json()
  }
}

const calibrationAPI = new CalibrationAPI('/api/calibration')

// Frame type configurations
const FRAME_TYPE_CONFIG = {
  [CalibrationFrameType.DARK]: {
    name: 'Dark Frames',
    icon: Moon,
    color: 'text-purple-400',
    description: 'Capture sensor noise at specific exposure times and temperatures',
    requiresExposure: true,
    defaultCount: 20,
    instructions: 'Cover telescope/lens completely. Match exposure times from your light frames.'
  },
  [CalibrationFrameType.BIAS]: {
    name: 'Bias Frames', 
    icon: Circle,
    color: 'text-blue-400',
    description: 'Capture readout noise with shortest possible exposure',
    requiresExposure: false,
    defaultCount: 50,
    instructions: 'Keep telescope/lens covered. Uses shortest camera exposure time.'
  },
  [CalibrationFrameType.FLAT]: {
    name: 'Flat Frames',
    icon: Sun,
    color: 'text-yellow-400', 
    description: 'Correct vignetting and dust shadows with even illumination',
    requiresExposure: false,
    defaultCount: 20,
    instructions: 'Use flat field panel or twilight sky for even illumination.'
  },
  [CalibrationFrameType.FLAT_DARK]: {
    name: 'Flat Dark Frames',
    icon: Square,
    color: 'text-gray-400',
    description: 'Dark frames matching flat field exposure times',
    requiresExposure: true,
    defaultCount: 20,
    instructions: 'Cover telescope/lens. Match exposure times from your flat frames.'
  }
}

// Preset configurations
const CALIBRATION_PRESETS = [
  {
    name: 'Complete Calibration Set',
    description: 'Full calibration: 50 bias, 20 darks per exposure, 20 flats',
    frames: [
      { type: CalibrationFrameType.BIAS, count: 50 },
      { type: CalibrationFrameType.DARK, count: 20, exposure_time: '30s' },
      { type: CalibrationFrameType.DARK, count: 20, exposure_time: '60s' },
      { type: CalibrationFrameType.DARK, count: 20, exposure_time: '120s' },
      { type: CalibrationFrameType.FLAT, count: 20, target_adu: 30000 }
    ]
  },
  {
    name: 'Quick Dark Set',
    description: 'Essential dark frames for current session exposures',
    frames: [
      { type: CalibrationFrameType.DARK, count: 15, exposure_time: '60s' },
      { type: CalibrationFrameType.DARK, count: 15, exposure_time: '120s' }
    ]
  },
  {
    name: 'Bias Only',
    description: 'Just bias frames for basic readout correction',
    frames: [
      { type: CalibrationFrameType.BIAS, count: 50 }
    ]
  }
]

export function CalibrationFrames() {
  const [selectedFrameType, setSelectedFrameType] = useState<CalibrationFrameType>(CalibrationFrameType.DARK)
  const [formData, setFormData] = useState<Partial<CalibrationRequest>>({
    count: FRAME_TYPE_CONFIG[CalibrationFrameType.DARK].defaultCount,
    interval_seconds: 2.0,
    delay_before_start: 0,
    target_adu: 30000
  })
  const [activeJobs, setActiveJobs] = useState<Map<string, CalibrationJobStatus>>(new Map())
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const statusIntervalRef = useRef<number | null>(null)

  // Poll job statuses
  useEffect(() => {
    if (activeJobs.size > 0) {
      statusIntervalRef.current = window.setInterval(async () => {
        const updatedJobs = new Map<string, CalibrationJobStatus>()
        
        for (const [jobId, job] of activeJobs) {
          if (['running', 'paused'].includes(job.status)) {
            try {
              const status = await calibrationAPI.getStatus(jobId)
              updatedJobs.set(jobId, status)
            } catch (err) {
              console.error(`Failed to get status for job ${jobId}:`, err)
              updatedJobs.set(jobId, job) // Keep old status
            }
          } else {
            updatedJobs.set(jobId, job) // Keep completed/failed jobs
          }
        }
        
        setActiveJobs(updatedJobs)
      }, 1000)
    }

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current)
        statusIntervalRef.current = null
      }
    }
  }, [activeJobs])

  // Update form defaults when frame type changes
  useEffect(() => {
    const config = FRAME_TYPE_CONFIG[selectedFrameType]
    setFormData(prev => ({
      ...prev,
      count: config.defaultCount,
      frame_type: selectedFrameType
    }))
  }, [selectedFrameType])

  const handleStartCalibration = async () => {
    try {
      setIsStarting(true)
      setError(null)

      const request: CalibrationRequest = {
        frame_type: selectedFrameType,
        count: formData.count || FRAME_TYPE_CONFIG[selectedFrameType].defaultCount,
        interval_seconds: formData.interval_seconds || 2.0,
        delay_before_start: formData.delay_before_start || 0,
        ...formData
      }

      const response = await calibrationAPI.startCalibration(request)
      setActiveJobs(prev => new Map(prev.set(response.job_id, response.status)))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start calibration')
    } finally {
      setIsStarting(false)
    }
  }

  const handleJobControl = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      switch (action) {
        case 'pause':
          await calibrationAPI.pauseJob(jobId)
          break
        case 'resume':
          await calibrationAPI.resumeJob(jobId)
          break
        case 'cancel':
          await calibrationAPI.cancelJob(jobId)
          break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} job`)
    }
  }

  const formatTimeRemaining = (estimatedCompletion?: string): string => {
    if (!estimatedCompletion) return 'Calculating...'
    
    const now = new Date()
    const completion = new Date(estimatedCompletion)
    const diff = completion.getTime() - now.getTime()
    
    if (diff <= 0) return 'Complete'
    
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getProgressPercentage = (job: CalibrationJobStatus): number => {
    return job.total_frames > 0 ? (job.completed_frames / job.total_frames) * 100 : 0
  }

  const config = FRAME_TYPE_CONFIG[selectedFrameType]
  const IconComponent = config.icon

  return (
    <div className="calibration-frames">
      <div className="config-header">
        <h2>
          <Camera className="inline w-6 h-6 mr-2" />
          Calibration Frames
        </h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="btn btn-secondary btn-sm"
          title="Advanced settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="calibration-content">
        {/* Frame Type Selection */}
        <div className="frame-type-selection">
          <h3>Frame Type</h3>
          <div className="frame-type-grid">
            {Object.entries(FRAME_TYPE_CONFIG).map(([type, typeConfig]) => {
              const TypeIcon = typeConfig.icon
              const isSelected = selectedFrameType === type
              
              return (
                <button
                  key={type}
                  onClick={() => setSelectedFrameType(type as CalibrationFrameType)}
                  className={`frame-type-card ${isSelected ? 'selected' : ''}`}
                >
                  <div className="frame-type-header">
                    <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
                    <h4>{typeConfig.name}</h4>
                  </div>
                  <p className="frame-type-description">{typeConfig.description}</p>
                  {isSelected && <span className="frame-type-badge">Selected</span>}
                </button>
              )
            })}
          </div>
        </div>

        {/* Current Frame Type Details */}
        <div className="frame-type-details">
          <div className="frame-type-info">
            <IconComponent className={`w-8 h-8 ${config.color}`} />
            <div>
              <h3>{config.name}</h3>
              <p>{config.description}</p>
              <div className="frame-instructions">
                <strong>Setup:</strong> {config.instructions}
              </div>
            </div>
          </div>
        </div>

        {/* Calibration Form */}
        <div className="calibration-form">
          <div className="form-section">
            <h3>Basic Settings</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="frame-count">Number of Frames:</label>
                <input
                  id="frame-count"
                  type="number"
                  min="1"
                  max="500"
                  value={formData.count || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                  className="input"
                />
              </div>

              {config.requiresExposure && (
                <div className="form-group">
                  <label htmlFor="exposure-time">Exposure Time:</label>
                  <select
                    id="exposure-time"
                    value={formData.exposure_time || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, exposure_time: e.target.value }))}
                    className="select"
                  >
                    <option value="">Select exposure...</option>
                    <option value="1s">1 second</option>
                    <option value="2s">2 seconds</option>
                    <option value="5s">5 seconds</option>
                    <option value="10s">10 seconds</option>
                    <option value="15s">15 seconds</option>
                    <option value="30s">30 seconds</option>
                    <option value="60s">1 minute</option>
                    <option value="120s">2 minutes</option>
                    <option value="300s">5 minutes</option>
                    <option value="600s">10 minutes</option>
                  </select>
                </div>
              )}

              {selectedFrameType === CalibrationFrameType.FLAT && (
                <div className="form-group">
                  <label htmlFor="target-adu">Target ADU Level:</label>
                  <input
                    id="target-adu"
                    type="number"
                    min="10000"
                    max="50000"
                    value={formData.target_adu || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_adu: parseInt(e.target.value) }))}
                    className="input"
                    placeholder="30000"
                  />
                  <div className="form-help">
                    Recommended: 25,000-35,000 ADU for optimal signal-to-noise ratio
                  </div>
                </div>
              )}
            </div>

            {/* Settings Summary */}
            <div className="settings-summary">
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Frames:</span>
                  <span className="summary-value">{formData.count || config.defaultCount}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Type:</span>
                  <span className="summary-value">{config.name}</span>
                </div>
                {formData.exposure_time && (
                  <div className="summary-item">
                    <span className="summary-label">Exposure:</span>
                    <span className="summary-value">{formData.exposure_time}</span>
                  </div>
                )}
                <div className="summary-item">
                  <span className="summary-label">Est. Time:</span>
                  <span className="summary-value">
                    {Math.ceil(((formData.count || config.defaultCount) * (formData.interval_seconds || 2)) / 60)}m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {showAdvanced && (
            <div className="form-section">
              <h3>Advanced Settings</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="interval">Interval Between Frames (seconds):</label>
                  <input
                    id="interval"
                    type="number"
                    min="0.1"
                    max="60"
                    step="0.1"
                    value={formData.interval_seconds || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, interval_seconds: parseFloat(e.target.value) }))}
                    className="input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="delay">Delay Before Start (seconds):</label>
                  <input
                    id="delay"
                    type="number"
                    min="0"
                    max="3600"
                    value={formData.delay_before_start || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, delay_before_start: parseInt(e.target.value) }))}
                    className="input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="base-name">Base Filename:</label>
                  <input
                    id="base-name"
                    type="text"
                    value={formData.base_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, base_name: e.target.value }))}
                    className="input"
                    placeholder={`${selectedFrameType}_frame`}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="save-path">Save Path:</label>
                  <input
                    id="save-path"
                    type="text"
                    value={formData.save_path || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, save_path: e.target.value }))}
                    className="input"
                    placeholder="calibration_frames"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="form-actions">
            <button
              onClick={handleStartCalibration}
              disabled={isStarting || !formData.count}
              className="btn btn-primary btn-lg"
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full mr-2" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start {config.name}
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Active Jobs */}
        {activeJobs.size > 0 && (
          <div className="active-jobs">
            <h3>
              <Clock className="w-4 h-4" />
              Active Calibration Jobs
            </h3>
            
            <div className="jobs-grid">
              {Array.from(activeJobs.values()).map(job => {
                const jobConfig = FRAME_TYPE_CONFIG[job.frame_type]
                const JobIcon = jobConfig.icon
                const progress = getProgressPercentage(job)
                
                return (
                  <div key={job.job_id} className={`job-card ${job.status}`}>
                    <div className="job-header">
                      <div className="job-info">
                        <JobIcon className={`w-5 h-5 ${jobConfig.color}`} />
                        <div>
                          <h4>{jobConfig.name}</h4>
                          <div className="job-status">
                            <span className={`status-badge status-${job.status}`}>
                              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                            </span>
                            {job.current_exposure && (
                              <span className="job-details">
                                <Clock className="w-3 h-3" />
                                {job.current_exposure}
                              </span>
                            )}
                            {job.current_temperature && (
                              <span className="job-details">
                                <Thermometer className="w-3 h-3" />
                                {job.current_temperature.toFixed(1)}°C
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="job-controls">
                        {job.status === 'running' && (
                          <button
                            onClick={() => handleJobControl(job.job_id, 'pause')}
                            className="btn btn-secondary btn-sm"
                            title="Pause job"
                          >
                            <Pause className="w-3 h-3" />
                          </button>
                        )}
                        
                        {job.status === 'paused' && (
                          <button
                            onClick={() => handleJobControl(job.job_id, 'resume')}
                            className="btn btn-primary btn-sm"
                            title="Resume job"
                          >
                            <Play className="w-3 h-3" />
                          </button>
                        )}
                        
                        {['running', 'paused'].includes(job.status) && (
                          <button
                            onClick={() => handleJobControl(job.job_id, 'cancel')}
                            className="btn btn-secondary btn-sm"
                            title="Cancel job"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="job-progress">
                      <div className="progress-info">
                        <span className="progress-stats">
                          {job.completed_frames} / {job.total_frames} frames
                          {job.failed_frames > 0 && (
                            <span className="failed-count"> ({job.failed_frames} failed)</span>
                          )}
                        </span>
                        
                        {job.status === 'running' && job.estimated_completion && (
                          <span className="time-remaining">
                            <Clock className="w-3 h-3" />
                            {formatTimeRemaining(job.estimated_completion)} remaining
                          </span>
                        )}
                      </div>
                      
                      <div className="progress-bar">
                        <div 
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      
                      <div className="progress-percentage">
                        {progress.toFixed(1)}%
                      </div>
                    </div>

                    {job.output_directory && (
                      <div className="job-output">
                        <FolderOpen className="w-3 h-3" />
                        <span className="output-path">{job.output_directory}</span>
                        <button 
                          className="copy-path-btn"
                          onClick={() => navigator.clipboard?.writeText(job.output_directory)}
                          title="Copy path to clipboard"
                        >
                          <Settings className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {job.error_message && (
                      <div className="job-error">
                        {job.error_message}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Quick Presets */}
        <div className="calibration-presets">
          <h3>
            <Settings className="w-4 h-4" />
            Quick Start Presets
          </h3>
          <div className="preset-grid">
            {CALIBRATION_PRESETS.map((preset, index) => (
              <div key={index} className="preset-card">
                <h4>{preset.name}</h4>
                <p>{preset.description}</p>
                <div className="preset-frames">
                  {preset.frames.map((frame, frameIndex) => (
                    <span key={frameIndex} className="preset-frame-badge">
                      {frame.count} {FRAME_TYPE_CONFIG[frame.type].name}
                      {frame.exposure_time && ` (${frame.exposure_time})`}
                    </span>
                  ))}
                </div>
                <div className="preset-actions">
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      // This would start the preset sequence
                      console.log('Starting preset:', preset.name)
                    }}
                  >
                    Start Preset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty Jobs State */}
        {activeJobs.size === 0 && (
          <div className="empty-jobs">
            <h4>No Active Calibration Jobs</h4>
            <p>Configure your calibration settings above and click "Start" to begin capturing calibration frames.</p>
          </div>
        )}
      </div>
    </div>
  )
}