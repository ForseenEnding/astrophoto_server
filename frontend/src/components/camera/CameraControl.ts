import type { CameraStatusResponse } from '@/types/api.ts';

export class CameraControl {
  private container!: HTMLElement;
  private status: CameraStatusResponse | null = null;
  private previewInterval: number | null = null;
  private isCapturing = false;
  private previewFps = 0.2; // Default: 1 frame every 5 seconds
  private isPreviewEnabled = true;

  mount(selector: string) {
    this.container = document.querySelector(selector)!;
    this.setupEventListeners();
    this.render();
    this.refresh();
    this.startPreviewUpdates();
  }

  unmount() {
    this.stopPreviewUpdates();
  }

  async refresh() {
    try {
      const response = await fetch('/api/camera/status');
      this.status = await response.json();
      this.render();
    } catch (error) {
      console.error('Failed to fetch camera status:', error);
      this.status = null;
      this.render();
    }
  }

  private setupEventListeners() {
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('connect-btn')) {
        await this.connectCamera();
      } else if (target.classList.contains('disconnect-btn')) {
        await this.disconnectCamera();
      } else if (target.classList.contains('capture-btn')) {
        await this.captureImage();
      } else if (target.classList.contains('preview-btn')) {
        await this.capturePreview();
      } else if (target.classList.contains('refresh-btn')) {
        await this.refresh();
      } else if (target.classList.contains('toggle-preview-btn')) {
        this.toggleAutoPreview();
      }
    });

    // Handle FPS dropdown changes
    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      
      if (target.classList.contains('fps-select')) {
        this.updatePreviewFps(parseFloat(target.value));
      }
    });
  }

  private toggleAutoPreview() {
    this.isPreviewEnabled = !this.isPreviewEnabled;
    
    if (this.isPreviewEnabled) {
      this.startPreviewUpdates();
      this.updateStatus('Auto-preview enabled');
    } else {
      this.stopPreviewUpdates();
      this.updateStatus('Auto-preview disabled');
    }
    
    this.updatePreviewControls();
  }

  private updatePreviewFps(fps: number) {
    this.previewFps = fps;
    this.updatePreviewControls();
    
    // Restart preview updates with new interval
    if (this.isPreviewEnabled) {
      this.stopPreviewUpdates();
      this.startPreviewUpdates();
    }
    
    const fpsText = this.getFpsDisplayText(fps);
    this.updateStatus(`Preview rate: ${fpsText}`);
  }

  private getFpsDisplayText(fps: number): string {
    if (fps === 0) return 'Manual only';
    if (fps < 1) return `${(1/fps).toFixed(0)}s interval`;
    return `${fps.toFixed(1)} FPS`;
  }

  private updatePreviewControls() {
    const toggleBtn = this.container.querySelector('.toggle-preview-btn') as HTMLButtonElement;
    const fpsSelect = this.container.querySelector('.fps-select') as HTMLSelectElement;
    
    if (toggleBtn) {
      toggleBtn.textContent = this.isPreviewEnabled ? '⏸️' : '▶️';
      toggleBtn.className = `toggle-preview-btn ${this.isPreviewEnabled ? 'enabled' : 'disabled'}`;
      toggleBtn.title = this.isPreviewEnabled ? 'Pause auto-preview' : 'Start auto-preview';
    }
    
    if (fpsSelect) {
      fpsSelect.value = this.previewFps.toString();
    }
  }

  private async connectCamera() {
    try {
      this.updateStatus('Connecting to camera...');
      const response = await fetch('/api/camera/connect', { method: 'POST' });
      const result = await response.json();
      
      if (response.ok) {
        this.updateStatus('Camera connected successfully');
        await this.refresh();
      } else {
        this.updateStatus(`Connection failed: ${result.detail}`, 'error');
      }
    } catch (error) {
      this.updateStatus('Connection error occurred', 'error');
      console.error('Connect error:', error);
    }
  }

  private async disconnectCamera() {
    try {
      this.updateStatus('Disconnecting camera...');
      const response = await fetch('/api/camera/disconnect', { method: 'POST' });
      
      if (response.ok) {
        this.updateStatus('Camera disconnected');
        await this.refresh();
      } else {
        this.updateStatus('Disconnect failed', 'error');
      }
    } catch (error) {
      this.updateStatus('Disconnect error occurred', 'error');
      console.error('Disconnect error:', error);
    }
  }

  private async captureImage() {
    if (this.isCapturing) return;
    
    try {
      this.isCapturing = true;
      this.updateCaptureButton(true);
      this.updateStatus('Checking active session...');

      // First, check for active session
      let activeSession = null;
      try {
        const sessionResponse = await fetch('/api/sessions/');
        const sessionData = await sessionResponse.json();
        
        if (sessionResponse.ok && sessionData.active_session_id) {
          // Get the active session details
          activeSession = sessionData.sessions.find(
            (s: any) => s.id === sessionData.active_session_id
          );
        }
      } catch (sessionError) {
        console.warn('Failed to fetch session data, using manual capture:', sessionError);
        // Continue with manual capture if session fetch fails
      }

      if (activeSession) {
        // Session-based capture
        this.updateStatus(`Capturing to session: ${activeSession.name}...`);
        
        const sessionCaptureData = {
          image_name: null // Let the backend auto-generate based on session
        };

        const response = await fetch(`/api/sessions/${activeSession.id}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionCaptureData)
        });

        const result = await response.json();

        if (response.ok) {
          const captureNum = result.capture_number || 'N/A';
          this.updateStatus(
            `✓ Session capture #${captureNum}: ${result.filename}`
          );
          this.displaySessionCaptureResult(result, activeSession);
        } else {
          // Session capture failed, try manual fallback
          this.updateStatus('Session capture failed, trying manual capture...', 'error');
          await this.fallbackToManualCapture();
        }
      } else {
        // Manual capture (no active session)
        this.updateStatus('No active session - capturing manually...');
        await this.performManualCapture();
      }

    } catch (error) {
      this.updateStatus('Capture error occurred', 'error');
      console.error('Capture error:', error);
    } finally {
      this.isCapturing = false;
      this.updateCaptureButton(false);
    }
  }

  private async performManualCapture() {
    const captureData = {
      save_to_path: 'manual_captures',
      image_name: `manual_${new Date().getTime()}`
    };

    const response = await fetch('/api/camera/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(captureData)
    });

    const result = await response.json();

    if (response.ok) {
      this.updateStatus(`Manual capture: ${result.filename}`);
      this.displayCaptureResult(result);
    } else {
      this.updateStatus(`Manual capture failed: ${result.detail}`, 'error');
    }
  }

  private async fallbackToManualCapture() {
    try {
      await this.performManualCapture();
    } catch (fallbackError) {
      this.updateStatus('Both session and manual capture failed', 'error');
      console.error('Fallback capture error:', fallbackError);
    }
  }

  private async capturePreview() {
    try {
      this.updateStatus('Capturing preview...');
      const response = await fetch('/api/camera/preview', { method: 'POST' });
      
      if (response.ok) {
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        this.displayPreview(imageUrl);
        this.updateStatus('Preview captured');
      } else {
        this.updateStatus('Preview failed', 'error');
      }
    } catch (error) {
      this.updateStatus('Preview error occurred', 'error');
      console.error('Preview error:', error);
    }
  }

  private startPreviewUpdates() {
    if (this.previewFps === 0 || !this.isPreviewEnabled) return;
    
    const intervalMs = 1000 / this.previewFps;
    
    this.previewInterval = window.setInterval(async () => {
      if (this.status?.connected && !this.isCapturing && this.isPreviewEnabled) {
        try {
          const response = await fetch('/api/camera/preview', { method: 'POST' });
          if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            this.updatePreviewImage(imageUrl); // Use separate method for auto-updates
          }
        } catch (error) {
          // Silently fail for auto-updates
        }
      }
    }, intervalMs);
  }

  private stopPreviewUpdates() {
    if (this.previewInterval) {
      clearInterval(this.previewInterval);
      this.previewInterval = null;
    }
  }

  private displayPreview(imageUrl: string) {
    // This is for manual preview captures - sets up the whole preview area
    const previewContainer = this.container.querySelector('.preview-display');
    if (previewContainer) {
      this.setupPreviewArea(previewContainer as HTMLElement);
      this.updatePreviewImage(imageUrl);
    }
  }

  private setupPreviewArea(container: HTMLElement) {
    // Only set up the preview area structure if it doesn't exist
    if (!container.querySelector('.preview-image-container')) {
      container.innerHTML = `
        <div class="preview-image-container">
          <img class="preview-image" alt="Camera Preview" />
        </div>
        <div class="preview-controls-overlay">
          <div class="preview-control-group">
            <label for="fps-select">Rate:</label>
            <select class="fps-select" id="fps-select">
              <option value="0">Manual</option>
              <option value="0.1">10s</option>
              <option value="0.2">5s</option>
              <option value="0.33">3s</option>
              <option value="0.5">2s</option>
              <option value="1">1s</option>
              <option value="2">0.5s</option>
            </select>
          </div>
          <button class="toggle-preview-btn ${this.isPreviewEnabled ? 'enabled' : 'disabled'}" title="${this.isPreviewEnabled ? 'Pause auto-preview' : 'Start auto-preview'}">
            ${this.isPreviewEnabled ? '⏸️' : '▶️'}
          </button>
        </div>
        <div class="preview-timestamp"></div>
      `;
      
      // Set the initial dropdown value
      this.updatePreviewControls();
    }
  }

  private updatePreviewImage(imageUrl: string) {
    // Only update the image and timestamp, leave controls intact
    const previewContainer = this.container.querySelector('.preview-display');
    if (!previewContainer) return;

    // Set up preview area if it doesn't exist
    if (!previewContainer.querySelector('.preview-image-container')) {
      this.setupPreviewArea(previewContainer as HTMLElement);
    }

    const img = previewContainer.querySelector('.preview-image') as HTMLImageElement;
    const timestamp = previewContainer.querySelector('.preview-timestamp');
    
    if (img && timestamp) {
      // Clean up previous image URL
      if (img.src.startsWith('blob:')) {
        URL.revokeObjectURL(img.src);
      }
      
      // Update image source
      img.src = imageUrl;
      
      // Update timestamp
      timestamp.textContent = new Date().toLocaleTimeString();
    }
  }

  private displayCaptureResult(result: any) {
    const resultContainer = this.container.querySelector('.capture-result');
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="capture-success">
          <h4>✓ Capture Successful</h4>
          <div class="capture-details">
            <div class="detail-row">
              <span>Filename:</span>
              <span class="mono">${result.filename}</span>
            </div>
            <div class="detail-row">
              <span>Size:</span>
              <span class="mono">${(result.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <div class="detail-row">
              <span>Timestamp:</span>
              <span class="mono">${new Date(result.timestamp).toLocaleString()}</span>
            </div>
            ${result.static_url ? `
              <div class="detail-row">
                <span>Location:</span>
                <a href="${result.static_url}" target="_blank" class="file-link">${result.static_url}</a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  }

  private displaySessionCaptureResult(result: any, session: any) {
    const resultContainer = this.container.querySelector('.capture-result');
    if (resultContainer) {
      const progress = session.capture_plan?.target_count ? 
        Math.round((result.capture_number / session.capture_plan.target_count) * 100) : 0;

      resultContainer.innerHTML = `
        <div class="capture-success session-capture">
          <h4>✓ Session Capture Successful</h4>
          <div class="session-info">
            <div class="detail-row">
              <span>Session:</span>
              <span class="mono">${session.name}</span>
            </div>
            <div class="detail-row">
              <span>Target:</span>
              <span class="mono">${session.target}</span>
            </div>
            <div class="detail-row">
              <span>Capture #:</span>
              <span class="mono">${result.capture_number}</span>
            </div>
            ${session.capture_plan?.target_count ? `
              <div class="detail-row">
                <span>Progress:</span>
                <span class="mono">${result.capture_number}/${session.capture_plan.target_count} (${progress}%)</span>
              </div>
            ` : ''}
          </div>
          <div class="capture-details">
            <div class="detail-row">
              <span>Filename:</span>
              <span class="mono">${result.filename}</span>
            </div>
            <div class="detail-row">
              <span>Size:</span>
              <span class="mono">${result.size_bytes ? (result.size_bytes / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}</span>
            </div>
            <div class="detail-row">
              <span>Timestamp:</span>
              <span class="mono">${new Date(result.timestamp).toLocaleString()}</span>
            </div>
            ${result.static_url ? `
              <div class="detail-row">
                <span>Location:</span>
                <a href="${result.static_url}" target="_blank" class="file-link">${result.static_url}</a>
              </div>
            ` : ''}
          </div>
          ${progress > 0 ? `
            <div class="session-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }
  }

  private updateStatus(message: string, type: 'info' | 'error' = 'info') {
    const statusElement = this.container.querySelector('.status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message ${type}`;
    }
  }

  private updateCaptureButton(capturing: boolean) {
    const captureBtn = this.container.querySelector('.capture-btn') as HTMLButtonElement;
    if (captureBtn) {
      captureBtn.disabled = capturing;
      captureBtn.textContent = capturing ? 'Capturing...' : 'Capture Image';
    }
  }

  private render() {
    if (!this.container) return;

    const isConnected = this.status?.connected || false;
    const connectionClass = isConnected ? 'connected' : 'disconnected';

    this.container.innerHTML = `
      <div class="camera-control">
        <div class="camera-header">
          <h2>Camera Control</h2>
          <button class="refresh-btn">🔄 Refresh</button>
        </div>

        <!-- Camera Status -->
        <div class="camera-status-panel ${connectionClass}">
          <div class="status-info">
            <div class="connection-status">
              <span class="status-indicator ${connectionClass}">
                ${isConnected ? '🟢' : '🔴'} ${isConnected ? 'Connected' : 'Disconnected'}
              </span>
              ${this.status ? `
                <span class="camera-model">${this.status.model}</span>
                <span class="battery-level">🔋 ${this.status.battery}</span>
              ` : ''}
            </div>
            <div class="connection-controls">
              ${!isConnected ? `
                <button class="connect-btn">Connect Camera</button>
              ` : `
                <button class="disconnect-btn">Disconnect</button>
              `}
            </div>
          </div>
        </div>

        <!-- Status Messages -->
        <div class="status-message info">Ready</div>

        ${isConnected ? `
          <!-- Camera Controls -->
          <div class="camera-controls">
            <div class="control-section">
              <h3>Capture Controls</h3>
              <div class="control-buttons">
                <button class="capture-btn">📸 Capture Image</button>
                <button class="preview-btn">👁️ Manual Preview</button>
              </div>
            </div>
          </div>

          <!-- Live Preview -->
          <div class="preview-section">
            <h3>Live Preview</h3>
            <div class="preview-container">
              <div class="preview-display">
                <div class="preview-placeholder">
                  <span>📷</span>
                  <p>Live preview will appear here</p>
                  <p class="preview-note">Controls will appear in the preview frame</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Capture Results -->
          <div class="capture-section">
            <h3>Last Capture</h3>
            <div class="capture-result">
              <div class="capture-placeholder">
                No captures yet. Click "Capture Image" to take your first photo.
              </div>
            </div>
          </div>
        ` : `
          <!-- Disconnected State -->
          <div class="disconnected-panel">
            <div class="disconnected-message">
              <h3>📷 Camera Not Connected</h3>
              <p>Connect your camera to begin capturing images.</p>
              <ul class="connection-tips">
                <li>Ensure camera is powered on</li>
                <li>Check USB connection</li>
                <li>Camera should be in PC/tethering mode</li>
                <li>No other software should be using the camera</li>
              </ul>
            </div>
          </div>
        `}
      </div>
    `;
  }
}