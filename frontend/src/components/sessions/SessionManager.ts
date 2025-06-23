import type { Session, SessionListResponse } from '@/types/api.ts';

export class SessionManager {
  private container!: HTMLElement;
  private sessions: SessionListResponse | null = null;
  private showingCreateForm = false;

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
      
      if (target.classList.contains('create-session-btn')) {
        this.toggleCreateForm();
      } else if (target.classList.contains('cancel-create-btn')) {
        this.hideCreateForm();
      } else if (target.classList.contains('submit-create-btn')) {
        await this.handleCreateSession();
      } else if (target.classList.contains('activate-session-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.activateSession(sessionId);
      } else if (target.classList.contains('delete-session-btn')) {
        const sessionId = target.dataset.sessionId;
        if (sessionId) await this.deleteSession(sessionId);
      } else if (target.classList.contains('deactivate-btn')) {
        await this.deactivateSession();
      }
    });
  }

  private toggleCreateForm() {
    this.showingCreateForm = !this.showingCreateForm;
    this.render();
  }

  private hideCreateForm() {
    this.showingCreateForm = false;
    this.render();
  }

  private async handleCreateSession() {
    const form = this.container.querySelector('#create-session-form') as HTMLFormElement;
    const formData = new FormData(form);
    
    const sessionData = {
      name: formData.get('name') as string,
      target: formData.get('target') as string,
      capture_plan: {
        target_count: parseInt(formData.get('target_count') as string) || 50,
        exposure_time: formData.get('exposure_time') as string || '30s',
        filter: formData.get('filter') as string || 'none'
      }
    };

    try {
      const response = await fetch('/api/sessions/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });

      if (response.ok) {
        this.hideCreateForm();
        await this.refresh();
      } else {
        console.error('Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  }

  private async activateSession(sessionId: string) {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/activate`, {
        method: 'POST'
      });
      
      if (response.ok) {
        await this.refresh();
      }
    } catch (error) {
      console.error('Error activating session:', error);
    }
  }

  private async deactivateSession() {
    try {
      const response = await fetch('/api/sessions/deactivate', {
        method: 'POST'
      });
      
      if (response.ok) {
        await this.refresh();
      }
    } catch (error) {
      console.error('Error deactivating session:', error);
    }
  }

  private async deleteSession(sessionId: string) {
    if (!confirm('Are you sure you want to delete this session? This will remove all captures and data.')) {
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await this.refresh();
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  private render() {
    if (!this.container) return;

    if (!this.sessions) {
      this.container.innerHTML = `
        <div class="session-manager error">
          <h2>Session Management</h2>
          <p class="error-message">Unable to load sessions</p>
        </div>
      `;
      return;
    }

    const activeSessionHtml = this.sessions.active_session_id ? `
      <div class="active-session-banner">
        <span>📡 Active Session: ${this.getSessionName(this.sessions.active_session_id)}</span>
        <button class="deactivate-btn">Deactivate</button>
      </div>
    ` : '';

    const createFormHtml = this.showingCreateForm ? this.renderCreateForm() : '';

    const sessionsHtml = this.sessions.sessions.length === 0 ? `
      <div class="empty-sessions">
        <p>No sessions created yet.</p>
        <p>Create your first astrophotography session to begin capturing!</p>
      </div>
    ` : this.sessions.sessions.map(session => this.renderSessionCard(session)).join('');

    this.container.innerHTML = `
      <div class="session-manager">
        <div class="session-header">
          <h2>Session Management</h2>
          <button class="create-session-btn ${this.showingCreateForm ? 'active' : ''}">
            ${this.showingCreateForm ? 'Cancel' : '+ New Session'}
          </button>
        </div>

        ${activeSessionHtml}
        ${createFormHtml}

        <div class="sessions-list">
          ${sessionsHtml}
        </div>
      </div>
    `;
  }

  private renderCreateForm(): string {
    return `
      <div class="create-session-form">
        <h3>Create New Session</h3>
        <form id="create-session-form">
          <div class="form-row">
            <div class="form-group">
              <label for="name">Session Name:</label>
              <input type="text" id="name" name="name" required placeholder="e.g., M31 Andromeda Galaxy">
            </div>
            <div class="form-group">
              <label for="target">Target Object:</label>
              <input type="text" id="target" name="target" required placeholder="e.g., M31, NGC7000">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="target_count">Target Image Count:</label>
              <input type="number" id="target_count" name="target_count" value="50" min="1" max="1000">
            </div>
            <div class="form-group">
              <label for="exposure_time">Exposure Time:</label>
              <select id="exposure_time" name="exposure_time">
                <option value="15s">15 seconds</option>
                <option value="30s" selected>30 seconds</option>
                <option value="60s">1 minute</option>
                <option value="120s">2 minutes</option>
                <option value="300s">5 minutes</option>
                <option value="600s">10 minutes</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="filter">Filter:</label>
              <select id="filter" name="filter">
                <option value="none">None</option>
                <option value="L">Luminance</option>
                <option value="R">Red</option>
                <option value="G">Green</option>
                <option value="B">Blue</option>
                <option value="Ha">Hydrogen Alpha</option>
                <option value="OIII">Oxygen III</option>
                <option value="SII">Sulfur II</option>
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="cancel-create-btn">Cancel</button>
            <button type="button" class="submit-create-btn">Create Session</button>
          </div>
        </form>
      </div>
    `;
  }

  private renderSessionCard(session: Session): string {
    const isActive = session.id === this.sessions?.active_session_id;
    const progress = session.capture_plan?.target_count ? 
      Math.round((session.statistics.successful_captures / session.capture_plan.target_count) * 100) : 0;

    return `
      <div class="session-card ${isActive ? 'active-session' : ''}">
        <div class="session-card-header">
          <h3>${session.name}</h3>
          <div class="session-status status-${session.status}">${session.status}</div>
        </div>

        <div class="session-details">
          <div class="detail-row">
            <span class="label">Target:</span>
            <span class="value">${session.target}</span>
          </div>
          <div class="detail-row">
            <span class="label">Created:</span>
            <span class="value">${this.formatDate(session.created_at)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Progress:</span>
            <span class="value">${session.statistics.successful_captures}/${session.capture_plan?.target_count || 'N/A'} (${progress}%)</span>
          </div>
        </div>

        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>

        <div class="session-actions">
          ${!isActive ? `<button class="activate-session-btn" data-session-id="${session.id}">Activate</button>` : ''}
          <button class="view-session-btn" data-session-id="${session.id}">View Details</button>
          <button class="delete-session-btn" data-session-id="${session.id}">Delete</button>
        </div>
      </div>
    `;
  }

  private getSessionName(sessionId: string): string {
    const session = this.sessions?.sessions.find(s => s.id === sessionId);
    return session ? session.name : sessionId;
  }
}