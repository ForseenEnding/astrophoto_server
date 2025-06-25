import {
    AlertCircle,
    Camera,
    CheckCircle,
    Circle,
    Clock,
    Eye,
    FolderOpen,
    Loader2,
    Moon,
    Pause,
    Play,
    Square,
    Sun,
    Thermometer,
    X
} from 'lucide-react'
import { useEffect, useState } from 'react'
  
  // Types
  enum CalibrationFrameType {
    DARK = 'dark',
    BIAS = 'bias', 
    FLAT = 'flat',
    FLAT_DARK = 'flat_dark'
  }
  
  interface CalibrationCaptureRequest {
    frame_type: CalibrationFrameType
    count: number
    exposure_time?: string
    target_adu?: number
    interval_seconds: number
    delay_before_start: number
  }
  
  interface CalibrationJobStatus {
    job_id: string
    session_id: string
    frame_type: CalibrationFrameType
    status: string
    created_at: string
    started_at?: string
    completed_at?: string
    total_frames: number
    completed_frames: number
    failed_frames: number
    current_temperature?: number
    average_adu?: number
    output_directory: string
    captured_files: string[]
    estimated_completion?: string
    error_message?: string
  }
  
  interface CalibrationStructure {
    session_id: string
    session_name: string
    calibration_structure: Record<string, {
      directory: string
      file_count: number
      files: string[]
      metadata_files: string[]
      last_capture?: number
    }>
  }
  
  interface SessionCalibrationManagerProps {
    sessionId: string
    sessionName: string
  }
  
  // Frame type configurations
  const FRAME_TYPE_CONFIG = {
    [CalibrationFrameType.DARK]: {
      name: 'Dark Frames',
      icon: Moon,
      color: 'text-purple-400',
      description: 'Capture sensor thermal noise patterns',
      requiresExposure: true,
      defaultCount: 20,
      exposures: ['30s', '60s', '120s', '180s', '300s']
    },
    [CalibrationFrameType.BIAS]: {
      name: 'Bias Frames',
      icon: Circle,
      color: 'text-blue-400',
      description: 'Capture readout noise patterns',
      requiresExposure: false,
      defaultCount: 50,
      exposures: []
    },
    [CalibrationFrameType.FLAT]: {
      name: 'Flat Field Frames',
      icon: Sun,
      color: 'text-yellow-400',
      description: 'Correct vignetting and dust spots',
      requiresExposure: false,
      defaultCount: 30,
      exposures: []
    },
    [CalibrationFrameType.FLAT_DARK]: {
      name: 'Flat Dark Frames',
      icon: Square,
      color: 'text-gray-400',
      description: 'Dark frames matching flat exposure times',
      requiresExposure: true,
      defaultCount: 20,
      exposures: ['1/30s', '1/60s', '1/125s']
    }
  }
  
  // API Service
  class SessionCalibrationAPI {
    private baseUrl: string
  
    constructor(baseUrl: string) {
      this.baseUrl = baseUrl
    }
  
    async startCalibration(sessionId: string, request: CalibrationCaptureRequest) {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      if (!response.ok) {
        throw new Error(`Failed to start calibration: ${response.statusText}`)
      }
      return response.json()
    }
  
    async getJobStatus(sessionId: string, jobId: string): Promise<CalibrationJobStatus> {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/${jobId}/status`)
      if (!response.ok) {
        throw new Error(`Failed to get job status: ${response.statusText}`)
      }
      return response.json()
    }
  
    async pauseJob(sessionId: string, jobId: string) {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/${jobId}/pause`, { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Failed to pause job: ${response.statusText}`)
      }
      return response.json()
    }
  
    async resumeJob(sessionId: string, jobId: string) {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/${jobId}/resume`, { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Failed to resume job: ${response.statusText}`)
      }
      return response.json()
    }
  
    async cancelJob(sessionId: string, jobId: string) {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/${jobId}/cancel`, { method: 'POST' })
      if (!response.ok) {
        throw new Error(`Failed to cancel job: ${response.statusText}`)
      }
      return response.json()
    }
  
    async getCalibrationStructure(sessionId: string): Promise<CalibrationStructure> {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/structure`)
      if (!response.ok) {
        throw new Error(`Failed to get calibration structure: ${response.statusText}`)
      }
      return response.json()
    }
  
    async listJobs(sessionId: string) {
      const response = await fetch(`${this.baseUrl}/${sessionId}/calibration/jobs`)
      if (!response.ok) {
        throw new Error(`Failed to list jobs: ${response.statusText}`)
      }
      return response.json()
    }
  }
  
  const calibrationAPI = new SessionCalibrationAPI('/api/sessions')
  
  // Progress Bar Component
  function ProgressBar({ value, max, className = '' }: { value: number, max: number, className?: string }) {
    const percentage = max > 0 ? Math.round((value / max) * 100) : 0
    
    return (
      <div className={`progress-container ${className}`}>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="progress-text">{value}/{max} ({percentage}%)</span>
      </div>
    )
  }
  
  // Job Status Component
  function CalibrationJobCard({ job, sessionId, onJobUpdate }: { 
    job: CalibrationJobStatus, 
    sessionId: string,
    onJobUpdate: () => void 
  }) {
    const config = FRAME_TYPE_CONFIG[job.frame_type]
    const IconComponent = config.icon
  
    const getStatusIcon = () => {
      switch (job.status) {
        case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        case 'paused': return <Pause className="w-4 h-4 text-yellow-400" />
        case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />
        case 'failed': return <X className="w-4 h-4 text-red-400" />
        case 'cancelled': return <X className="w-4 h-4 text-gray-400" />
        default: return <Clock className="w-4 h-4 text-gray-400" />
      }
    }
  
    const handleJobControl = async (action: 'pause' | 'resume' | 'cancel') => {
      try {
        switch (action) {
          case 'pause':
            await calibrationAPI.pauseJob(sessionId, job.job_id)
            break
          case 'resume':
            await calibrationAPI.resumeJob(sessionId, job.job_id)
            break
          case 'cancel':
            await calibrationAPI.cancelJob(sessionId, job.job_id)
            break
        }
        onJobUpdate()
      } catch (error) {
        console.error(`Failed to ${action} job:`, error)
      }
    }
  
    return (
      <div className="calibration-job-card">
        <div className="job-header">
          <div className="job-info">
            <IconComponent className={`w-5 h-5 ${config.color}`} />
            <span className="job-title">{config.name}</span>
            <span className="job-id">#{job.job_id.slice(0, 8)}</span>
          </div>
          <div className="job-status">
            {getStatusIcon()}
            <span className="status-text">{job.status}</span>
          </div>
        </div>
  
        <ProgressBar 
          value={job.completed_frames} 
          max={job.total_frames}
          className="job-progress"
        />
  
        {job.status === 'running' && (
          <div className="job-details">
            {job.current_temperature && (
              <div className="detail-item">
                <Thermometer className="w-4 h-4" />
                <span>{job.current_temperature.toFixed(1)}°C</span>
              </div>
            )}
            {job.estimated_completion && (
              <div className="detail-item">
                <Clock className="w-4 h-4" />
                <span>ETA: {new Date(job.estimated_completion).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        )}
  
        {job.error_message && (
          <div className="error-message">
            <AlertCircle className="w-4 h-4" />
            <span>{job.error_message}</span>
          </div>
        )}
  
        <div className="job-actions">
          {job.status === 'running' && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => handleJobControl('pause')}
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}
          {job.status === 'paused' && (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => handleJobControl('resume')}
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}
          {['running', 'paused'].includes(job.status) && (
            <button 
              className="btn btn-error btn-sm"
              onClick={() => handleJobControl('cancel')}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}
          {job.status === 'completed' && (
            <button 
              className="btn btn-secondary btn-sm"
              onClick={() => window.open(`/projects/${sessionId}/calibration/${job.frame_type}`, '_blank')}
            >
              <FolderOpen className="w-4 h-4" />
              View Files
            </button>
          )}
        </div>
      </div>
    )
  }
  
  // Main Component
  export function SessionCalibrationManager({ sessionId, sessionName }: SessionCalibrationManagerProps) {
    const [selectedFrameType, setSelectedFrameType] = useState<CalibrationFrameType>(CalibrationFrameType.DARK)
    const [formData, setFormData] = useState({
      count: 20,
      exposure_time: '120s',
      target_adu: 30000,
      interval_seconds: 2.0,
      delay_before_start: 0
    })
    
    const [activeJobs, setActiveJobs] = useState<CalibrationJobStatus[]>([])
    const [calibrationStructure, setCalibrationStructure] = useState<CalibrationStructure | null>(null)
    const [isStarting, setIsStarting] = useState(false)
    const [error, setError] = useState<string | null>(null)
  
    // Load calibration structure and jobs on mount
    useEffect(() => {
      loadCalibrationData()
      
      // Poll for job updates
      const interval = setInterval(loadCalibrationData, 2000)
      return () => clearInterval(interval)
    }, [sessionId])
  
    const loadCalibrationData = async () => {
      try {
        const [structure, jobs] = await Promise.all([
          calibrationAPI.getCalibrationStructure(sessionId),
          calibrationAPI.listJobs(sessionId)
        ])
        
        setCalibrationStructure(structure)
        setActiveJobs(Object.values(jobs.jobs || {}))
        setError(null)
      } catch (err) {
        console.error('Failed to load calibration data:', err)
        setError('Failed to load calibration data')
      }
    }
  
    const handleStartCalibration = async () => {
      setIsStarting(true)
      setError(null)
  
      try {
        const request: CalibrationCaptureRequest = {
          frame_type: selectedFrameType,
          count: formData.count,
          interval_seconds: formData.interval_seconds,
          delay_before_start: formData.delay_before_start,
          ...(FRAME_TYPE_CONFIG[selectedFrameType].requiresExposure && {
            exposure_time: formData.exposure_time
          }),
          ...(selectedFrameType === CalibrationFrameType.FLAT && {
            target_adu: formData.target_adu
          })
        }
  
        await calibrationAPI.startCalibration(sessionId, request)
        await loadCalibrationData()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start calibration')
      } finally {
        setIsStarting(false)
      }
    }
  
    const config = FRAME_TYPE_CONFIG[selectedFrameType]
    const IconComponent = config.icon
  
    return (
      <div className="session-calibration-manager">
        <div className="calibration-header">
          <h2>
            <Camera className="w-6 h-6" />
            Calibration Frames - {sessionName}
          </h2>
        </div>
  
        {/* Frame Type Selection */}
        <div className="frame-type-selection">
          <h3>Select Frame Type</h3>
          <div className="frame-type-grid">
            {Object.entries(FRAME_TYPE_CONFIG).map(([type, typeConfig]) => {
              const TypeIcon = typeConfig.icon
              const isSelected = selectedFrameType === type
              const existingFrames = calibrationStructure?.calibration_structure[type]?.file_count || 0
              
              return (
                <button
                  key={type}
                  className={`frame-type-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedFrameType(type as CalibrationFrameType)}
                >
                  <div className="frame-type-header">
                    <TypeIcon className={`w-6 h-6 ${typeConfig.color}`} />
                    <h4>{typeConfig.name}</h4>
                    {existingFrames > 0 && (
                      <span className="frame-count-badge">{existingFrames}</span>
                    )}
                  </div>
                  <p className="frame-type-description">{typeConfig.description}</p>
                </button>
              )
            })}
          </div>
        </div>
  
        {/* Calibration Form */}
        <div className="calibration-form">
          <div className="form-section">
            <h3>
              <IconComponent className={`w-5 h-5 ${config.color}`} />
              {config.name} Configuration
            </h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Frame Count:</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="200"
                  value={formData.count}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    count: parseInt(e.target.value) || config.defaultCount 
                  }))}
                />
              </div>
              
              {config.requiresExposure && (
                <div className="form-group">
                  <label>Exposure Time:</label>
                  <select
                    className="select"
                    value={formData.exposure_time}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      exposure_time: e.target.value 
                    }))}
                  >
                    {config.exposures.map(exp => (
                      <option key={exp} value={exp}>{exp}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {selectedFrameType === CalibrationFrameType.FLAT && (
                <div className="form-group">
                  <label>Target ADU:</label>
                  <input
                    type="number"
                    className="input"
                    min="15000"
                    max="45000"
                    step="1000"
                    value={formData.target_adu}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      target_adu: parseInt(e.target.value) || 30000 
                    }))}
                  />
                </div>
              )}
              
              <div className="form-group">
                <label>Interval (seconds):</label>
                <input
                  type="number"
                  className="input"
                  min="0.5"
                  max="60"
                  step="0.5"
                  value={formData.interval_seconds}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    interval_seconds: parseFloat(e.target.value) || 2.0 
                  }))}
                />
              </div>
            </div>
            
            <div className="form-actions">
              <button
                onClick={handleStartCalibration}
                disabled={isStarting}
                className="btn btn-primary"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Capture
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
  
        {/* Error Display */}
        {error && (
          <div className="error-message">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
  
        {/* Active Jobs */}
        {activeJobs.length > 0 && (
          <div className="active-jobs">
            <h3>Active Calibration Jobs</h3>
            <div className="jobs-list">
              {activeJobs.map(job => (
                <CalibrationJobCard
                  key={job.job_id}
                  job={job}
                  sessionId={sessionId}
                  onJobUpdate={loadCalibrationData}
                />
              ))}
            </div>
          </div>
        )}
  
        {/* Calibration Summary */}
        {calibrationStructure && (
          <div className="calibration-summary">
            <h3>
              <FolderOpen className="w-5 h-5" />
              Calibration Library
            </h3>
            <div className="summary-grid">
              {Object.entries(calibrationStructure.calibration_structure).map(([frameType, data]) => {
                const typeConfig = FRAME_TYPE_CONFIG[frameType as CalibrationFrameType]
                if (!typeConfig) return null
                
                const TypeIcon = typeConfig.icon
                
                return (
                  <div key={frameType} className="summary-card">
                    <div className="summary-header">
                      <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
                      <h4>{typeConfig.name}</h4>
                    </div>
                    <div className="summary-stats">
                      <div className="stat">
                        <span className="stat-label">Files:</span>
                        <span className="stat-value">{data.file_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Size:</span>
                        <span className="stat-value">
                          {data.file_count > 0 ? `~${Math.round(data.file_count * 25)}MB` : '0MB'}
                        </span>
                      </div>
                    </div>
                    {data.file_count > 0 && (
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => window.open(`/projects/${sessionId}/calibration/${frameType}`, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                        View Files
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }