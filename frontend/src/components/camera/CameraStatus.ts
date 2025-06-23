import type { CameraStatusResponse } from '@/types/api.ts';

export class CameraStatus {
  private container!: HTMLElement;
  private status: CameraStatusResponse | null = null;

  mount(selector: string) {
    this.container = document.querySelector(selector)!;
    this.render();
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

  private render() {
    if (!this.container) return;

    if (!this.status) {
      this.container.innerHTML = `
        <div class="camera-status error">
          <span>⚠️ Unable to connect to camera</span>
        </div>
      `;
      return;
    }

    const statusIcon = this.status.connected ? '🟢' : '🔴';
    const statusText = this.status.connected ? 'Connected' : 'Disconnected';

    this.container.innerHTML = `
      <div class="camera-status ${this.status.connected ? 'connected' : 'disconnected'}">
        <span class="status-indicator">${statusIcon} ${statusText}</span>
        <span class="camera-model">${this.status.model}</span>
        <span class="battery-level">🔋 ${this.status.battery}</span>
      </div>
    `;
  }
}