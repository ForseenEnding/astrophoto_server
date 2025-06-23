import type { SessionListResponse } from '@/types/api.ts';

interface AnalysisResult {
  filename: string;
  analyzed_at: string;
  metadata: {
    filename: string;
    file_size_bytes: number;
    image_width: number;
    image_height: number;
    created_at: string;
    iso?: number;
    aperture?: string;
    shutter_speed?: string;
    focal_length?: string;
  };
  focus_analysis: {
    focus_score: number;
    sharpness_score: number;
    edge_density?: number;
  };
  histogram: {
    mean_brightness: number;
    median_brightness: number;
    std_brightness: number;
    clipped_highlights: number;
    clipped_shadows: number;
  };
  stats: {
    mean_value: number;
    median_value: number;
    std_deviation: number;
    min_value: number;
    max_value: number;
    dynamic_range: number;
  };
  star_detection?: {
    star_count: number;
    average_star_brightness: number;
    brightest_star_value: number;
  };
  analysis_duration_ms: number;
  thumbnail_generated: boolean;
  thumbnail_path?: string;
}

interface BatchAnalysisResult {
  session_id: string;
  total_images: number;
  analyzed_images: number;
  skipped_images: number;
  failed_images: number;
  analysis_duration_ms: number;
  results: AnalysisResult[];
}

interface FocusTrendData {
  session_id: string;
  focus_data: Array<{
    image_number: number;
    filename: string;
    focus_score: number;
    captured_at: string;
    timestamp: number;
  }>;
  statistics: {
    mean: number;
    median: number;
    std: number;
    min: number;
    max: number;
    trend: string;
  };
  total_images: number;
}

export class ImageAnalysis {
  private container!: HTMLElement;
  private sessions: SessionListResponse | null = null;
  private selectedSessionId: string | null = null;
  private isAnalyzing = false;
  private currentView: 'overview' | 'session' | 'trends' | 'compare' = 'overview';

  mount(selector: string) {
    this.container = document.querySelector(selector)!;
    this.setupEventListeners();
    this.render();
    this.refresh();
  }

  async refresh() {
    try {
      const response = await fetch('/api/sessions/');
      this.sessions = await response.json();
      this.render();
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      this.sessions = null;
      this.render();
    }
  }

  private setupEventListeners() {
    this.container.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('view-tab')) {
        const view = target.dataset.view as typeof this.currentView;
        if (view) this.switchView(view);
      } else if (target.classList.contains('analyze-session-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.analyzeSession(sessionId);
      } else if (target.classList.contains('view-session-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.viewSessionAnalysis(sessionId);
      } else if (target.classList.contains('view-trends-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.viewFocusTrends(sessionId);
      } else if (target.classList.contains('analyze-single-btn')) {
        await this.analyzeSingleImage();
      } else if (target.classList.contains('clear-analysis-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.clearSessionAnalysis(sessionId);
      }
    });

    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      
      if (target.classList.contains('session-select')) {
        this.selectedSessionId = target.value || null;
        this.updateSessionView();
      }
    });
  }

  private switchView(view: typeof this.currentView) {
    this.currentView = view;
    this.render();
    
    // Load data for specific views
    if (view === 'session' && this.selectedSessionId) {
      this.updateSessionView();
    }
  }

  private async analyzeSession(sessionId: string) {
    if (this.isAnalyzing) return;
    
    try {
      this.isAnalyzing = true;
      this.updateAnalysisStatus('Starting batch analysis...', 'info');
      this.updateAnalyzeButton(sessionId, true);

      const requestData = {
        detect_stars: false,
        generate_thumbnails: true,
        force_reanalyze: false
      };

      const response = await fetch(`/api/analysis/session/${sessionId}/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      });

      const result: BatchAnalysisResult = await response.json();

      if (response.ok) {
        const duration = (result.analysis_duration_ms / 1000).toFixed(1);
        this.updateAnalysisStatus(
          `Analysis complete: ${result.analyzed_images} analyzed, ${result.skipped_images} skipped, ${result.failed_images} failed (${duration}s)`,
          'info'
        );
        this.displayBatchResults(result);
      } else {
        this.updateAnalysisStatus(`Analysis failed: ${result}`, 'error');
      }
    } catch (error) {
      this.updateAnalysisStatus('Analysis error occurred', 'error');
      console.error('Analysis error:', error);
    } finally {
      this.isAnalyzing = false;
      this.updateAnalyzeButton(sessionId, false);
    }
  }

  private async viewSessionAnalysis(sessionId: string) {
    this.selectedSessionId = sessionId;
    this.switchView('session');
  }

  private async viewFocusTrends(sessionId: string) {
    this.selectedSessionId = sessionId;
    this.switchView('trends');
    await this.loadFocusTrends(sessionId);
  }

  private async loadFocusTrends(sessionId: string) {
    try {
      const response = await fetch(`/api/analysis/session/${sessionId}/focus-trend`);
      const data: FocusTrendData = await response.json();
      
      if (response.ok) {
        this.displayFocusTrends(data);
      } else {
        this.updateAnalysisStatus('Failed to load focus trends', 'error');
      }
    } catch (error) {
      this.updateAnalysisStatus('Error loading focus trends', 'error');
      console.error('Focus trends error:', error);
    }
  }

  private async analyzeSingleImage() {
    // This would open a file picker or input for single image analysis
    this.updateAnalysisStatus('Single image analysis not yet implemented', 'info');
  }

  private async clearSessionAnalysis(sessionId: string) {
    if (!confirm('Are you sure you want to clear all analysis data for this session?')) {
      return;
    }

    try {
      const response = await fetch(`/api/analysis/session/${sessionId}/analysis`, {
        method: 'DELETE'
      });

      if (response.ok) {
        this.updateAnalysisStatus('Analysis data cleared', 'info');
        this.refresh();
      } else {
        this.updateAnalysisStatus('Failed to clear analysis data', 'error');
      }
    } catch (error) {
      this.updateAnalysisStatus('Error clearing analysis data', 'error');
      console.error('Clear analysis error:', error);
    }
  }

  private updateSessionView() {
    const sessionContent = this.container.querySelector('.session-analysis-content');
    if (sessionContent && this.selectedSessionId) {
      this.loadSessionAnalysisData(this.selectedSessionId);
    }
  }

  private async loadSessionAnalysisData(sessionId: string) {
    try {
      const response = await fetch(`/api/analysis/session/${sessionId}/best-images`);
      const data = await response.json();
      
      if (response.ok) {
        this.displaySessionAnalysis(data);
      } else {
        this.updateAnalysisStatus('Failed to load session analysis', 'error');
      }
    } catch (error) {
      this.updateAnalysisStatus('Error loading session analysis', 'error');
      console.error('Session analysis error:', error);
    }
  }

  private displayBatchResults(result: BatchAnalysisResult) {
    const resultsContainer = this.container.querySelector('.batch-results');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="batch-summary">
          <h4>Batch Analysis Complete</h4>
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${result.total_images}</span>
              <span class="stat-label">Total Images</span>
            </div>
            <div class="stat-item success">
              <span class="stat-value">${result.analyzed_images}</span>
              <span class="stat-label">Analyzed</span>
            </div>
            <div class="stat-item neutral">
              <span class="stat-value">${result.skipped_images}</span>
              <span class="stat-label">Skipped</span>
            </div>
            <div class="stat-item error">
              <span class="stat-value">${result.failed_images}</span>
              <span class="stat-label">Failed</span>
            </div>
          </div>
          <div class="duration">
            Analysis completed in ${(result.analysis_duration_ms / 1000).toFixed(1)} seconds
          </div>
        </div>
        
        ${result.results.length > 0 ? `
          <div class="top-results">
            <h4>Top Focus Scores</h4>
            <div class="results-grid">
              ${result.results
                .sort((a, b) => b.focus_analysis.focus_score - a.focus_analysis.focus_score)
                .slice(0, 6)
                .map(result => `
                  <div class="result-card">
                    <div class="result-header">
                      <span class="filename">${result.filename}</span>
                      <span class="focus-score">${result.focus_analysis.focus_score.toFixed(1)}</span>
                    </div>
                    <div class="result-stats">
                      <div class="stat">Brightness: ${result.histogram.mean_brightness.toFixed(0)}</div>
                      <div class="stat">Stars: ${result.star_detection?.star_count || 'N/A'}</div>
                    </div>
                  </div>
                `).join('')}
            </div>
          </div>
        ` : ''}
      `;
    }
  }

  private displaySessionAnalysis(data: any) {
    const sessionContent = this.container.querySelector('.session-analysis-content');
    if (sessionContent) {
      sessionContent.innerHTML = `
        <div class="session-analysis-data">
          <h4>Best Images (by Focus Score)</h4>
          <div class="best-images-grid">
            ${data.images.map((img: any) => `
              <div class="image-analysis-card">
                <div class="image-header">
                  <span class="filename">${img.filename}</span>
                  <span class="focus-score">${img.focus_score?.toFixed(1) || 'N/A'}</span>
                </div>
                <div class="image-stats">
                  <div class="stat-row">
                    <span>Size:</span>
                    <span>${(img.size_bytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div class="stat-row">
                    <span>Captured:</span>
                    <span>${new Date(img.captured_at).toLocaleString()}</span>
                  </div>
                </div>
                ${img.static_url ? `
                  <div class="image-actions">
                    <a href="${img.static_url}" target="_blank" class="view-image-btn">View Image</a>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  private displayFocusTrends(data: FocusTrendData) {
    const trendsContent = this.container.querySelector('.trends-content');
    if (trendsContent) {
      trendsContent.innerHTML = `
        <div class="trends-analysis">
          <div class="trends-summary">
            <h4>Focus Trend Analysis</h4>
            <div class="trend-stats">
              <div class="trend-stat">
                <span class="label">Average Focus:</span>
                <span class="value">${data.statistics.mean.toFixed(1)}</span>
              </div>
              <div class="trend-stat">
                <span class="label">Best Focus:</span>
                <span class="value">${data.statistics.max.toFixed(1)}</span>
              </div>
              <div class="trend-stat">
                <span class="label">Trend:</span>
                <span class="value trend-${data.statistics.trend}">${data.statistics.trend}</span>
              </div>
            </div>
          </div>
          
          <div class="focus-chart">
            <h5>Focus Score Over Time</h5>
            <div class="chart-container">
              ${this.createSimpleFocusChart(data.focus_data)}
            </div>
          </div>
          
          <div class="focus-timeline">
            <h5>Recent Focus Scores</h5>
            <div class="timeline-items">
              ${data.focus_data.slice(-10).map(item => `
                <div class="timeline-item">
                  <span class="timeline-time">${new Date(item.captured_at).toLocaleTimeString()}</span>
                  <span class="timeline-filename">${item.filename}</span>
                  <span class="timeline-score">${item.focus_score.toFixed(1)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  }

  private createSimpleFocusChart(data: Array<{focus_score: number, image_number: number}>): string {
    if (data.length === 0) return '<p>No focus data available</p>';
    
    const maxScore = Math.max(...data.map(d => d.focus_score));
    const minScore = Math.min(...data.map(d => d.focus_score));
    const range = maxScore - minScore || 1;
    
    return `
      <div class="simple-chart">
        ${data.map((point, index) => {
          const height = ((point.focus_score - minScore) / range) * 100;
          return `
            <div class="chart-bar" style="height: ${height}%" title="Image ${point.image_number}: ${point.focus_score.toFixed(1)}">
              <div class="bar-value">${point.focus_score.toFixed(0)}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="chart-axis">
        <span>Image #1</span>
        <span>Image #${data.length}</span>
      </div>
    `;
  }

  private updateAnalysisStatus(message: string, type: 'info' | 'error' = 'info') {
    const statusElement = this.container.querySelector('.analysis-status');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `analysis-status ${type}`;
    }
  }

  private updateAnalyzeButton(sessionId: string, analyzing: boolean) {
    const button = this.container.querySelector(`[data-session-id="${sessionId}"].analyze-session-btn`) as HTMLButtonElement;
    if (button) {
      button.disabled = analyzing;
      button.textContent = analyzing ? 'Analyzing...' : 'Analyze Session';
    }
  }

  private getSessionName(sessionId: string): string {
    const session = this.sessions?.sessions.find(s => s.id === sessionId);
    return session ? session.name : sessionId;
  }

  private render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="image-analysis">
        <div class="analysis-header">
          <h2>Image Analysis</h2>
          <div class="analysis-tabs">
            <button class="view-tab ${this.currentView === 'overview' ? 'active' : ''}" data-view="overview">Overview</button>
            <button class="view-tab ${this.currentView === 'session' ? 'active' : ''}" data-view="session">Session Analysis</button>
            <button class="view-tab ${this.currentView === 'trends' ? 'active' : ''}" data-view="trends">Focus Trends</button>
          </div>
        </div>

        <div class="analysis-status info">Ready for analysis</div>

        <div class="analysis-content">
          ${this.renderCurrentView()}
        </div>
      </div>
    `;
  }

  private renderCurrentView(): string {
    switch (this.currentView) {
      case 'overview':
        return this.renderOverviewView();
      case 'session':
        return this.renderSessionView();
      case 'trends':
        return this.renderTrendsView();
      default:
        return this.renderOverviewView();
    }
  }

  private renderOverviewView(): string {
    if (!this.sessions || this.sessions.sessions.length === 0) {
      return `
        <div class="empty-analysis">
          <h3>No Sessions Available</h3>
          <p>Create some sessions and capture images to begin analysis.</p>
        </div>
      `;
    }

    return `
      <div class="overview-content">
        <div class="analysis-actions">
          <h3>Batch Analysis</h3>
          <p>Analyze all images in a session for focus quality, brightness, and star detection.</p>
        </div>

        <div class="sessions-analysis-list">
          ${this.sessions.sessions.map(session => `
            <div class="session-analysis-card">
              <div class="session-info">
                <h4>${session.name}</h4>
                <div class="session-details">
                  <span>Target: ${session.target}</span>
                  <span>Images: ${session.statistics.successful_captures}</span>
                </div>
              </div>
              <div class="session-actions">
                <button class="analyze-session-btn" data-session-id="${session.id}">
                  Analyze Session
                </button>
                <button class="view-session-btn" data-session-id="${session.id}">
                  View Results
                </button>
                <button class="view-trends-btn" data-session-id="${session.id}">
                  Focus Trends
                </button>
                <button class="clear-analysis-btn" data-session-id="${session.id}">
                  Clear Data
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="batch-results"></div>
      </div>
    `;
  }

  private renderSessionView(): string {
    const sessionOptions = this.sessions?.sessions.map(s => 
      `<option value="${s.id}" ${s.id === this.selectedSessionId ? 'selected' : ''}>${s.name}</option>`
    ).join('') || '';

    return `
      <div class="session-view">
        <div class="session-selector">
          <label for="session-select">Select Session:</label>
          <select class="session-select" id="session-select">
            <option value="">Choose a session...</option>
            ${sessionOptions}
          </select>
        </div>
        
        <div class="session-analysis-content">
          ${this.selectedSessionId ? `
            <div class="loading-analysis">Loading analysis data...</div>
          ` : `
            <div class="no-session-selected">
              <p>Select a session to view analysis results.</p>
            </div>
          `}
        </div>
      </div>
    `;
  }

  private renderTrendsView(): string {
    const sessionOptions = this.sessions?.sessions.map(s => 
      `<option value="${s.id}" ${s.id === this.selectedSessionId ? 'selected' : ''}>${s.name}</option>`
    ).join('') || '';

    return `
      <div class="trends-view">
        <div class="session-selector">
          <label for="trends-session-select">Select Session:</label>
          <select class="session-select" id="trends-session-select">
            <option value="">Choose a session...</option>
            ${sessionOptions}
          </select>
        </div>
        
        <div class="trends-content">
          ${this.selectedSessionId ? `
            <div class="loading-trends">Loading focus trends...</div>
          ` : `
            <div class="no-session-selected">
              <p>Select a session to view focus trends.</p>
            </div>
          `}
        </div>
      </div>
    `;
  }
}