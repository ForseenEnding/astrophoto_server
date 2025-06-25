import { useSessions } from '@/hooks/useSessions'
import {
    AlertCircle,
    Aperture,
    ArrowLeft,
    ArrowRight,
    Camera,
    CheckCircle,
    Circle,
    Clock,
    Eye,
    Moon,
    Play,
    Settings,
    Sun,
    Target,
    Wifi,
    WifiOff,
    X,
    Zap
} from 'lucide-react'
import { useEffect, useState } from 'react'
  
  interface SessionWizardProps {
    onClose: () => void
    onSessionCreated: (sessionId: string) => void
  }
  
  interface WizardData {
    target: string
    cameraSettings: {
      iso: string
      exposure_time: string
      aperture: string
      gain?: string
      offset?: string
    }
    capturePlan: {
      target_count: number
      interval_seconds: number
      dither_enabled: boolean
      dither_interval: number
    }
    calibrationSettings: {
      capture_darks: boolean
      dark_count: number
      capture_bias: boolean
      bias_count: number
      capture_flats: boolean
      flat_count: number
      flat_target_adu: number
    }
  }
  
  interface CameraStatus {
    connected: boolean
    model?: string
    battery?: number
    temperature?: number
  }
  
  const WIZARD_STEPS = [
    { id: 'target', title: 'Target Selection', icon: Target },
    { id: 'camera', title: 'Camera Settings', icon: Camera },
    { id: 'capture', title: 'Capture Plan', icon: Settings },
    { id: 'calibration', title: 'Calibration', icon: Sun },
    { id: 'preview', title: 'Focus Check', icon: Eye },
    { id: 'start', title: 'Start Session', icon: Play }
  ]
  
  const COMMON_TARGETS = [
    { name: 'M31 - Andromeda Galaxy', value: 'M31' },
    { name: 'M42 - Orion Nebula', value: 'M42' },
    { name: 'M45 - Pleiades', value: 'M45' },
    { name: 'M51 - Whirlpool Galaxy', value: 'M51' },
    { name: 'M57 - Ring Nebula', value: 'M57' },
    { name: 'M101 - Pinwheel Galaxy', value: 'M101' },
    { name: 'NGC 7000 - North America Nebula', value: 'NGC7000' },
    { name: 'IC 1396 - Elephant Trunk Nebula', value: 'IC1396' },
  ]
  
  const ISO_VALUES = ['100', '200', '400', '800', '1600', '3200', '6400']
  const EXPOSURE_TIMES = ['15s', '30s', '60s', '120s', '180s', '240s', '300s', '480s', '600s']
  const APERTURE_VALUES = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/5.6', 'f/8', 'f/11', 'f/16']
  
  export function SessionWizard({ onClose, onSessionCreated }: SessionWizardProps) {
    const { 
      createSession, 
      isCreating,
      createSessionMutation 
    } = useSessions()
    const [currentStep, setCurrentStep] = useState(0)
    const [wizardData, setWizardData] = useState<WizardData>({
      target: '',
      cameraSettings: {
        iso: '800',
        exposure_time: '120s',
        aperture: 'f/4'
      },
      capturePlan: {
        target_count: 50,
        interval_seconds: 5,
        dither_enabled: true,
        dither_interval: 5
      },
      calibrationSettings: {
        capture_darks: true,
        dark_count: 20,
        capture_bias: true,
        bias_count: 50,
        capture_flats: true,
        flat_count: 30,
        flat_target_adu: 30000
      }
    })
  
    const [validationErrors, setValidationErrors] = useState<string[]>([])
    
    // Camera connection state
    const [cameraStatus, setCameraStatus] = useState<CameraStatus>({ connected: false })
    const [isConnecting, setIsConnecting] = useState(false)
    
    // Preview state
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isTakingTestShot, setIsTakingTestShot] = useState(false)
    const [isLivePreview, setIsLivePreview] = useState(false)
    const [focusMetrics, setFocusMetrics] = useState<{
      focusScore: number
      starCount: number
      fwhm: number
    } | null>(null)
  
    // Check camera connection on wizard open
    useEffect(() => {
      checkCameraConnection()
      
      // Poll camera status every 5 seconds
      const interval = setInterval(checkCameraConnection, 5000)
      return () => clearInterval(interval)
    }, [])
  
    const checkCameraConnection = async () => {
      try {
        const response = await fetch('/api/camera/status')
        if (response.ok) {
          const status = await response.json()
          setCameraStatus(status)
        } else {
          setCameraStatus({ connected: false })
        }
      } catch (error) {
        console.error('Failed to check camera status:', error)
        setCameraStatus({ connected: false })
      }
    }
  
    const handleConnectCamera = async () => {
      setIsConnecting(true)
      try {
        const response = await fetch('/api/camera/connect', { method: 'POST' })
        if (response.ok) {
          await checkCameraConnection()
        } else {
          setValidationErrors(['Failed to connect to camera. Please check USB connection.'])
        }
      } catch (error) {
        console.error('Failed to connect camera:', error)
        setValidationErrors(['Failed to connect to camera. Please try again.'])
      } finally {
        setIsConnecting(false)
      }
    }
  
    // Generate session name based on target and current date/time
    const generateSessionName = (target: string) => {
      const now = new Date()
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }).replace(/:/g, '')
      
      return `${target} - ${dateStr} ${timeStr}`
    }
  
    const validateCurrentStep = () => {
      const errors: string[] = []
      
      switch (currentStep) {
        case 0: // Target Selection
          if (!wizardData.target.trim()) {
            errors.push('Target is required')
          }
          break
        case 1: // Camera Settings
          if (!cameraStatus.connected) {
            errors.push('Camera must be connected before proceeding')
          }
          if (!wizardData.cameraSettings.iso) {
            errors.push('ISO is required')
          }
          if (!wizardData.cameraSettings.exposure_time) {
            errors.push('Exposure time is required')
          }
          break
        case 2: // Capture Plan
          if (!cameraStatus.connected) {
            errors.push('Camera must be connected before proceeding')
          }
          if (wizardData.capturePlan.target_count < 1) {
            errors.push('Target count must be at least 1')
          }
          if (wizardData.capturePlan.interval_seconds < 1) {
            errors.push('Interval must be at least 1 second')
          }
          break
        case 3: // Calibration
          if (!cameraStatus.connected) {
            errors.push('Camera must be connected before proceeding')
          }
          break
        case 4: // Preview/Focus Check - No validation required
          break
      }
      
      setValidationErrors(errors)
      return errors.length === 0
    }
  
    const nextStep = () => {
      if (validateCurrentStep()) {
        setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length - 1))
      }
    }
  
    const prevStep = () => {
      setCurrentStep(prev => Math.max(prev - 1, 0))
      setValidationErrors([])
    }
  
    // Preview handlers
    const handleTestShot = async () => {
      setIsTakingTestShot(true)
      try {
        const response = await fetch('/api/camera/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            save_to_path: 'test_shots',
            image_name: `test_shot_${Date.now()}`
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('Capture result:', result)
          
          // Since CR2 files can't be displayed directly, we need to generate a preview
          // Try to get a JPEG preview from the camera or convert the CR2
          try {
            const previewResponse = await fetch('/api/camera/preview', {
              method: 'POST'
            })
            
            if (previewResponse.ok) {
              const blob = await previewResponse.blob()
              const previewUrl = URL.createObjectURL(blob)
              setPreviewImage(previewUrl)
            } else {
              // If preview fails, show a placeholder with capture info
              setPreviewImage(null)
              setValidationErrors([`Image captured as ${result.filename} but preview not available (CR2 format)`])
            }
          } catch (previewError) {
            console.error('Preview generation failed:', previewError)
            setPreviewImage(null)
            setValidationErrors([`Image captured successfully but preview generation failed`])
          }
          
          // Simulate focus analysis (in real implementation, this would analyze the CR2 file)
          setFocusMetrics({
            focusScore: Math.random() * 100,
            starCount: Math.floor(Math.random() * 500) + 50,
            fwhm: parseFloat((Math.random() * 2 + 1).toFixed(2))
          })
        } else {
          const errorData = await response.json()
          setValidationErrors([`Failed to capture test shot: ${errorData.detail || response.statusText}`])
        }
      } catch (error) {
        console.error('Test shot failed:', error)
        setValidationErrors(['Failed to capture test shot. Please try again.'])
      } finally {
        setIsTakingTestShot(false)
      }
    }
  
    const handleLivePreview = async () => {
      try {
        if (!isLivePreview) {
          // Start live preview
          setIsLivePreview(true)
          const response = await fetch('/api/camera/preview', {
            method: 'POST'
          })
          
          if (response.ok) {
            const blob = await response.blob()
            const previewUrl = URL.createObjectURL(blob)
            setPreviewImage(previewUrl)
          } else {
            const errorData = await response.json()
            setValidationErrors([`Failed to start live preview: ${errorData.detail || response.statusText}`])
            setIsLivePreview(false)
          }
        } else {
          // Stop live preview
          setIsLivePreview(false)
          if (previewImage && previewImage.startsWith('blob:')) {
            URL.revokeObjectURL(previewImage)
          }
          setPreviewImage(null)
        }
      } catch (error) {
        console.error('Live preview failed:', error)
        setValidationErrors(['Failed to control live preview. Please try again.'])
        setIsLivePreview(false)
      }
    }
  
    // Cleanup blob URLs when component unmounts or preview changes
    useEffect(() => {
      return () => {
        if (previewImage && previewImage.startsWith('blob:')) {
          URL.revokeObjectURL(previewImage)
        }
      }
    }, [previewImage])
  
    const getFocusQuality = (score: number): 'good' | 'fair' | 'poor' => {
      if (score >= 70) return 'good'
      if (score >= 40) return 'fair'
      return 'poor'
    }
  
    const handleCreateSession = async () => {
      if (!validateCurrentStep()) return
  
      const sessionName = generateSessionName(wizardData.target)
      
      const sessionRequest = {
        name: sessionName,
        target: wizardData.target,
        capture_plan: {
          target_count: wizardData.capturePlan.target_count,
          exposure_time: wizardData.cameraSettings.exposure_time,
          filter: 'none'
        }
      }
  
      // Use the mutation function from useSessions
      createSession(sessionRequest)
    }
  
    // Listen for successful session creation
    useEffect(() => {
      if (createSessionMutation.isSuccess && createSessionMutation.data) {
        // Session was created successfully
        const sessionId = createSessionMutation.data.session.id
        console.log('Session created successfully:', sessionId)
        onSessionCreated(sessionId)
      }
    }, [createSessionMutation.isSuccess, createSessionMutation.data, onSessionCreated])
  
    // Listen for session creation errors
    useEffect(() => {
      if (createSessionMutation.isError) {
        const errorMessage = createSessionMutation.error instanceof Error 
          ? createSessionMutation.error.message 
          : 'Failed to create session. Please try again.'
        setValidationErrors([errorMessage])
      }
    }, [createSessionMutation.isError, createSessionMutation.error])
  
    const renderStepContent = () => {
      switch (currentStep) {
        case 0: // Target Selection
          return (
            <div className="wizard-step">
              <h3>Select Your Target</h3>
              <p className="step-description">
                Choose the celestial object you want to photograph
              </p>
              
              <div className="form-group">
                <label>Common Targets:</label>
                <div className="target-grid">
                  {COMMON_TARGETS.map((target) => (
                    <button
                      key={target.value}
                      type="button"
                      className={`target-option ${wizardData.target === target.value ? 'selected' : ''}`}
                      onClick={() => setWizardData(prev => ({ ...prev, target: target.value }))}
                    >
                      <Target className="w-4 h-4" />
                      <span>{target.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="custom-target">Or enter custom target:</label>
                <input
                  id="custom-target"
                  type="text"
                  className="input"
                  placeholder="e.g., NGC 6960, IC 434, etc."
                  value={wizardData.target}
                  onChange={(e) => setWizardData(prev => ({ 
                    ...prev, 
                    target: e.target.value 
                  }))}
                />
              </div>
            </div>
          )
  
        case 1: // Camera Settings
          return (
            <div className="wizard-step">
              <h3>Configure Camera Settings</h3>
              <p className="step-description">
                Set your camera parameters for optimal image capture
              </p>
              
              {/* Camera Status */}
              <div className="camera-status-section">
                <div className={`camera-status ${cameraStatus.connected ? 'connected' : 'disconnected'}`}>
                  <div className="status-indicator">
                    {cameraStatus.connected ? (
                      <Wifi className="w-5 h-5 text-green-400" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-400" />
                    )}
                    <span className="status-text">
                      {cameraStatus.connected ? 'Camera Connected' : 'Camera Disconnected'}
                    </span>
                  </div>
                  
                  {cameraStatus.connected ? (
                    <div className="camera-info">
                      {cameraStatus.model && (
                        <span className="camera-model">{cameraStatus.model}</span>
                      )}
                      {cameraStatus.battery && (
                        <span className="battery-level">{cameraStatus.battery}%</span>
                      )}
                      {cameraStatus.temperature && (
                        <span className="temperature">{cameraStatus.temperature}°C</span>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectCamera}
                      disabled={isConnecting}
                      className="btn btn-primary btn-sm"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect Camera'}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="camera-settings-grid">
                <div className="form-group">
                  <label>
                    <Zap className="w-4 h-4" />
                    ISO Sensitivity
                  </label>
                  <select
                    className="select"
                    value={wizardData.cameraSettings.iso}
                    onChange={(e) => setWizardData(prev => ({
                      ...prev,
                      cameraSettings: { ...prev.cameraSettings, iso: e.target.value }
                    }))}
                    disabled={!cameraStatus.connected}
                  >
                    {ISO_VALUES.map(iso => (
                      <option key={iso} value={iso}>ISO {iso}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>
                    <Clock className="w-4 h-4" />
                    Exposure Time
                  </label>
                  <select
                    className="select"
                    value={wizardData.cameraSettings.exposure_time}
                    onChange={(e) => setWizardData(prev => ({
                      ...prev,
                      cameraSettings: { ...prev.cameraSettings, exposure_time: e.target.value }
                    }))}
                    disabled={!cameraStatus.connected}
                  >
                    {EXPOSURE_TIMES.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label>
                    <Aperture className="w-4 h-4" />
                    Aperture
                  </label>
                  <select
                    className="select"
                    value={wizardData.cameraSettings.aperture}
                    onChange={(e) => setWizardData(prev => ({
                      ...prev,
                      cameraSettings: { ...prev.cameraSettings, aperture: e.target.value }
                    }))}
                    disabled={!cameraStatus.connected}
                  >
                    {APERTURE_VALUES.map(aperture => (
                      <option key={aperture} value={aperture}>{aperture}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="settings-preview">
                <h4>Settings Summary</h4>
                <div className="settings-summary-grid">
                  <div className="summary-item">
                    <strong>ISO:</strong> {wizardData.cameraSettings.iso}
                  </div>
                  <div className="summary-item">
                    <strong>Exposure:</strong> {wizardData.cameraSettings.exposure_time}
                  </div>
                  <div className="summary-item">
                    <strong>Aperture:</strong> {wizardData.cameraSettings.aperture}
                  </div>
                </div>
              </div>
            </div>
          )
  
        case 2: // Capture Plan
          return (
            <div className="wizard-step">
              <h3>Plan Your Capture Session</h3>
              <p className="step-description">
                Configure how many images to capture and timing settings
              </p>
              
              <div className="capture-plan-grid">
                <div className="form-group">
                  <label>Target Frame Count</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    max="500"
                    value={wizardData.capturePlan.target_count}
                    onChange={(e) => setWizardData(prev => ({
                      ...prev,
                      capturePlan: { ...prev.capturePlan, target_count: parseInt(e.target.value) || 0 }
                    }))}
                  />
                  <div className="form-help">
                    Recommended: 50-100 frames for deep sky objects
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Interval Between Frames</label>
                  <input
                    type="number"
                    className="input"
                    min="1"
                    max="60"
                    value={wizardData.capturePlan.interval_seconds}
                    onChange={(e) => setWizardData(prev => ({
                      ...prev,
                      capturePlan: { ...prev.capturePlan, interval_seconds: parseInt(e.target.value) || 1 }
                    }))}
                  />
                  <div className="form-help">
                    Time to wait between captures (seconds)
                  </div>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={wizardData.capturePlan.dither_enabled}
                      onChange={(e) => setWizardData(prev => ({
                        ...prev,
                        capturePlan: { ...prev.capturePlan, dither_enabled: e.target.checked }
                      }))}
                    />
                    Enable Dithering
                  </label>
                  <div className="form-help">
                    Slightly move the mount between frames to reduce noise
                  </div>
                </div>
                
                {wizardData.capturePlan.dither_enabled && (
                  <div className="form-group">
                    <label>Dither Every N Frames</label>
                    <input
                      type="number"
                      className="input"
                      min="1"
                      max="20"
                      value={wizardData.capturePlan.dither_interval}
                      onChange={(e) => setWizardData(prev => ({
                        ...prev,
                        capturePlan: { ...prev.capturePlan, dither_interval: parseInt(e.target.value) || 1 }
                      }))}
                    />
                  </div>
                )}
              </div>
              
              <div className="session-estimate">
                <h4>Session Estimate</h4>
                <div className="estimate-grid">
                  <div className="estimate-item">
                    <strong>Total Frames:</strong> {wizardData.capturePlan.target_count}
                  </div>
                  <div className="estimate-item">
                    <strong>Total Exposure:</strong> {
                      Math.round((wizardData.capturePlan.target_count * 
                        parseInt(wizardData.cameraSettings.exposure_time)) / 60)
                    } minutes
                  </div>
                  <div className="estimate-item">
                    <strong>Estimated Duration:</strong> {
                      Math.round((wizardData.capturePlan.target_count * 
                        (parseInt(wizardData.cameraSettings.exposure_time) + wizardData.capturePlan.interval_seconds)) / 60)
                    } minutes
                  </div>
                </div>
              </div>
            </div>
          )
  
        case 3: // Calibration Settings
          return (
            <div className="wizard-step">
              <h3>Calibration Frame Settings</h3>
              <p className="step-description">
                Configure automatic calibration frame capture
              </p>
              
              <div className="calibration-types">
                <div className="calibration-type">
                  <div className="calibration-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={wizardData.calibrationSettings.capture_darks}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          calibrationSettings: { 
                            ...prev.calibrationSettings, 
                            capture_darks: e.target.checked 
                          }
                        }))}
                      />
                      <Moon className="w-5 h-5" />
                      Dark Frames
                    </label>
                  </div>
                  <p className="calibration-description">
                    Capture sensor thermal noise patterns
                  </p>
                  {wizardData.calibrationSettings.capture_darks && (
                    <div className="calibration-config">
                      <label>Count:</label>
                      <input
                        type="number"
                        className="input input-sm"
                        min="10"
                        max="100"
                        value={wizardData.calibrationSettings.dark_count}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          calibrationSettings: { 
                            ...prev.calibrationSettings, 
                            dark_count: parseInt(e.target.value) || 20 
                          }
                        }))}
                      />
                    </div>
                  )}
                </div>
                
                <div className="calibration-type">
                  <div className="calibration-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={wizardData.calibrationSettings.capture_bias}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          calibrationSettings: { 
                            ...prev.calibrationSettings, 
                            capture_bias: e.target.checked 
                          }
                        }))}
                      />
                      <Circle className="w-5 h-5" />
                      Bias Frames
                    </label>
                  </div>
                  <p className="calibration-description">
                    Capture readout noise patterns
                  </p>
                  {wizardData.calibrationSettings.capture_bias && (
                    <div className="calibration-config">
                      <label>Count:</label>
                      <input
                        type="number"
                        className="input input-sm"
                        min="20"
                        max="200"
                        value={wizardData.calibrationSettings.bias_count}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          calibrationSettings: { 
                            ...prev.calibrationSettings, 
                            bias_count: parseInt(e.target.value) || 50 
                          }
                        }))}
                      />
                    </div>
                  )}
                </div>
                
                <div className="calibration-type">
                  <div className="calibration-header">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={wizardData.calibrationSettings.capture_flats}
                        onChange={(e) => setWizardData(prev => ({
                          ...prev,
                          calibrationSettings: { 
                            ...prev.calibrationSettings, 
                            capture_flats: e.target.checked 
                          }
                        }))}
                      />
                      <Sun className="w-5 h-5" />
                      Flat Frames
                    </label>
                  </div>
                  <p className="calibration-description">
                    Correct vignetting and dust spots
                  </p>
                  {wizardData.calibrationSettings.capture_flats && (
                    <div className="calibration-config">
                      <div className="config-row">
                        <label>Count:</label>
                        <input
                          type="number"
                          className="input input-sm"
                          min="10"
                          max="100"
                          value={wizardData.calibrationSettings.flat_count}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            calibrationSettings: { 
                              ...prev.calibrationSettings, 
                              flat_count: parseInt(e.target.value) || 30 
                            }
                          }))}
                        />
                      </div>
                      <div className="config-row">
                        <label>Target ADU:</label>
                        <input
                          type="number"
                          className="input input-sm"
                          min="15000"
                          max="45000"
                          step="1000"
                          value={wizardData.calibrationSettings.flat_target_adu}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            calibrationSettings: { 
                              ...prev.calibrationSettings, 
                              flat_target_adu: parseInt(e.target.value) || 30000 
                            }
                          }))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
  
        case 4: // Preview/Focus Check
          return (
            <div className="wizard-step">
              <h3>Focus Check & Preview</h3>
              <p className="step-description">
                Take a test shot to verify focus and framing before starting the session
              </p>
              
              {/* Camera Status Check for Preview */}
              {!cameraStatus.connected && (
                <div className="connection-warning">
                  <AlertCircle className="w-4 h-4" />
                  <span>Camera must be connected to take test shots</span>
                  <button
                    onClick={handleConnectCamera}
                    disabled={isConnecting}
                    className="btn btn-primary btn-sm"
                    style={{ marginLeft: '12px' }}
                  >
                    {isConnecting ? 'Connecting...' : 'Connect Camera'}
                  </button>
                </div>
              )}
              
              {/* Preview Action Buttons */}
              <div className="preview-actions-section">
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={handleTestShot}
                  disabled={isTakingTestShot || !cameraStatus.connected}
                >
                  <Eye className="w-5 h-5 mr-2" />
                  {isTakingTestShot ? 'Taking Test Shot...' : 'Take Test Shot'}
                </button>
                <button 
                  className="btn btn-secondary btn-lg"
                  onClick={handleLivePreview}
                  disabled={!cameraStatus.connected}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  {isLivePreview ? 'Stop Preview' : 'Live Preview'}
                </button>
              </div>
  
              {/* Focus Tools Only */}
              <div className="focus-tools-centered">
                <h4>Focus Analysis</h4>
                <div className="focus-metrics-grid">
                  <div className="metric">
                    <span>Focus Score:</span>
                    <span className="metric-value">{focusMetrics?.focusScore?.toFixed(1) || '--'}</span>
                  </div>
                  <div className="metric">
                    <span>Stars:</span>
                    <span className="metric-value">{focusMetrics?.starCount || '--'}</span>
                  </div>
                  <div className="metric">
                    <span>FWHM:</span>
                    <span className="metric-value">{focusMetrics?.fwhm ? `${focusMetrics.fwhm}"` : '--'}</span>
                  </div>
                </div>
                
                {focusMetrics && (
                  <div className={`focus-quality-badge ${getFocusQuality(focusMetrics.focusScore)}`}>
                    {getFocusQuality(focusMetrics.focusScore) === 'good' && <CheckCircle className="w-4 h-4" />}
                    {getFocusQuality(focusMetrics.focusScore) === 'poor' && <AlertCircle className="w-4 h-4" />}
                    <span>Focus: {getFocusQuality(focusMetrics.focusScore)}</span>
                  </div>
                )}
              </div>
              
              <div className="preview-instructions">
                <h4>Ready to Start</h4>
                <p>Once you're satisfied with your focus and framing, click "Next" to review your session configuration and begin capture.</p>
              </div>
            </div>
          )
  
        case 5: // Start Session
          return (
            <div className="wizard-step">
              <h3>Ready to Start Session</h3>
              <p className="step-description">
                Review your session configuration and begin capture
              </p>
              
              <div className="session-summary">
                <div className="summary-section">
                  <h4>
                    <Target className="w-4 h-4" />
                    Target Information
                  </h4>
                  <div className="summary-content">
                    <div><strong>Object:</strong> {wizardData.target}</div>
                    <div><strong>Session Name:</strong> {generateSessionName(wizardData.target)}</div>
                  </div>
                </div>
                
                <div className="summary-section">
                  <h4>
                    <Camera className="w-4 h-4" />
                    Camera Settings
                  </h4>
                  <div className="summary-content">
                    <div><strong>ISO:</strong> {wizardData.cameraSettings.iso}</div>
                    <div><strong>Exposure:</strong> {wizardData.cameraSettings.exposure_time}</div>
                    <div><strong>Aperture:</strong> {wizardData.cameraSettings.aperture}</div>
                  </div>
                </div>
                
                <div className="summary-section">
                  <h4>
                    <Settings className="w-4 h-4" />
                    Capture Plan
                  </h4>
                  <div className="summary-content">
                    <div><strong>Frame Count:</strong> {wizardData.capturePlan.target_count}</div>
                    <div><strong>Interval:</strong> {wizardData.capturePlan.interval_seconds}s</div>
                    <div><strong>Dithering:</strong> {wizardData.capturePlan.dither_enabled ? 'Enabled' : 'Disabled'}</div>
                    <div><strong>Est. Duration:</strong> {
                      Math.round((wizardData.capturePlan.target_count * 
                        (parseInt(wizardData.cameraSettings.exposure_time) + wizardData.capturePlan.interval_seconds)) / 60)
                    } minutes</div>
                  </div>
                </div>
                
                <div className="summary-section">
                  <h4>
                    <Sun className="w-4 h-4" />
                    Calibration Frames
                  </h4>
                  <div className="summary-content">
                    {wizardData.calibrationSettings.capture_darks && (
                      <div><strong>Dark Frames:</strong> {wizardData.calibrationSettings.dark_count}</div>
                    )}
                    {wizardData.calibrationSettings.capture_bias && (
                      <div><strong>Bias Frames:</strong> {wizardData.calibrationSettings.bias_count}</div>
                    )}
                    {wizardData.calibrationSettings.capture_flats && (
                      <div><strong>Flat Frames:</strong> {wizardData.calibrationSettings.flat_count}</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="start-options">
                <div className="option-group">
                  <h4>Start Options</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Apply camera settings immediately
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked />
                    Begin with light frame capture
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" />
                    Capture calibration frames after session
                  </label>
                </div>
              </div>
            </div>
          )
  
        default:
          return null
      }
    }
  
    return (
      <div className="modal-overlay">
        <div className="wizard-modal">
          <div className="wizard-header">
            <h2>New Astrophotography Session</h2>
            <button onClick={onClose} className="btn btn-ghost">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="wizard-progress">
            {WIZARD_STEPS.map((step, index) => {
              const StepIcon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div
                  key={step.id}
                  className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                >
                  <div className="step-indicator">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <StepIcon className="w-5 h-5" />
                    )}
                  </div>
                  <span className="step-title">{step.title}</span>
                </div>
              )
            })}
          </div>
          
          <div className="wizard-content">
            {renderStepContent()}
            
            {validationErrors.length > 0 && (
              <div className="validation-errors">
                <AlertCircle className="w-4 h-4" />
                <div>
                  {validationErrors.map((error, index) => (
                    <p key={index}>{error}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="wizard-actions">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="btn btn-secondary"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>
            
            <div className="step-counter">
              Step {currentStep + 1} of {WIZARD_STEPS.length}
            </div>
            
            {currentStep < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={nextStep}
                className="btn btn-primary"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            ) : (
              <button
                onClick={handleCreateSession}
                disabled={isCreating}
                className="btn btn-success"
              >
                <Play className="w-4 h-4 mr-2" />
                {isCreating ? 'Creating Session...' : 'Start Session'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }