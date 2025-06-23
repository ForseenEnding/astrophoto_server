import type { SessionListResponse } from '@/types/api.ts';

export class SessionList {
  private container!: HTMLElement;
  private sessions: SessionListResponse | null = null;

  mount(selector: string) {
    this.container = document.querySelector(selector)!;
    this.render();
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

  private render() {
    if (!this.container) return;

    if (!this.sessions) {
      this.container.innerHTML = `
        <div class="session-list error">
          <p>Unable to load sessions</p>
        </div>
      `;
      return;
    }

    if (this.sessions.sessions.length === 0) {
      this.container.innerHTML = `
        <div class="session-list empty">
          <p>No sessions yet. Create your first session!</p>
          <button class="create-session-btn">+ Create Session</button>
        </div>
      `;
      return;
    }

    const sessionsHtml = this.sessions.sessions.map(session => `
      <div class="session-card ${session.id === this.sessions?.active_session_id ? 'active' : ''}">
        <h3>${session.name}</h3>
        <p class="session-target">Target: ${session.target}</p>
        <p class="session-stats">
          ${session.statistics.successful_captures} captures
        </p>
        <div class="session-status status-${session.status}">
          ${session.status}
        </div>
      </div>
    `).join('');

    this.container.innerHTML = `
      <div class="session-list">
        <div class="session-header">
          <h3>Recent Sessions</h3>
          <button class="create-session-btn">+ New</button>
        </div>
        <div class="sessions-grid">
          ${sessionsHtml}
        </div>
      </div>
    `;
  }
}