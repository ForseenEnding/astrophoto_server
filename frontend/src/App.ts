import { ImageAnalysis } from './components/analysis/ImageAnalysis.ts';
import { CameraControl } from './components/camera/CameraControl.ts';
import { CameraStatus } from './components/camera/CameraStatus.ts';
import { SessionList } from './components/sessions/SessionList.ts';
import { SessionManager } from './components/sessions/SessionManager.ts';

export class App {
  private container!: HTMLElement;
  private cameraStatus!: CameraStatus;
  private cameraControl!: CameraControl;
  private sessionList!: SessionList;
  private sessionManager!: SessionManager;
  private imageAnalysis!: ImageAnalysis;

  constructor() {
    this.setupEventListeners();
  }

  mount(selector: string) {
    this.container = document.querySelector(selector)!;
    this.render();
    this.initialize();
  }

  private render() {
    this.container.innerHTML = `
      <div class="app">
        <header class="app-header">
          <h1>Astrophotography Control</h1>
          <div id="camera-status"></div>
        </header>
        
        <div class="app-content">
          <aside class="sidebar">
            <nav class="nav">
              <button class="nav-button active" data-view="dashboard">Dashboard</button>
              <button class="nav-button" data-view="camera">Camera</button>
              <button class="nav-button" data-view="sessions">Sessions</button>
              <button class="nav-button" data-view="analysis">Analysis</button>
            </nav>
          </aside>
          
          <main class="main-content">
            <div id="view-dashboard" class="view active">
              <h2>Dashboard</h2>
              <div id="session-list"></div>
            </div>
            
            <div id="view-camera" class="view">
              <div id="camera-control"></div>
            </div>
            
            <div id="view-sessions" class="view">
              <div id="session-manager"></div>
            </div>
            
            <div id="view-analysis" class="view">
              <div id="image-analysis"></div>
            </div>
          </main>
        </div>
      </div>
    `;
  }

  private async initialize() {
    // Initialize components
    this.cameraStatus = new CameraStatus();
    this.cameraStatus.mount('#camera-status');

    this.cameraControl = new CameraControl();
    this.cameraControl.mount('#camera-control');

    this.sessionList = new SessionList();
    this.sessionList.mount('#session-list');

    this.sessionManager = new SessionManager();
    this.sessionManager.mount('#session-manager');

    this.imageAnalysis = new ImageAnalysis();
    this.imageAnalysis.mount('#image-analysis');

    // Load initial data
    await this.loadInitialData();
  }

  private async loadInitialData() {
    try {
      // Load camera status and sessions in parallel
      await Promise.all([
        this.cameraStatus.refresh(),
        this.sessionList.refresh()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  }

  private setupEventListeners() {
    // Navigation handling
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('nav-button')) {
        const view = target.dataset.view;
        if (view) {
          this.showView(view);
          this.updateActiveNav(target);
        }
      }
    });
  }

  private showView(viewName: string) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Show selected view
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.add('active');
    }

    // Refresh components when their views are shown
    if (viewName === 'sessions' && this.sessionManager) {
      this.sessionManager.refresh();
    } else if (viewName === 'camera' && this.cameraControl) {
      this.cameraControl.refresh();
    } else if (viewName === 'analysis' && this.imageAnalysis) {
      this.imageAnalysis.refresh();
    }
  }

  private updateActiveNav(activeButton: HTMLElement) {
    document.querySelectorAll('.nav-button').forEach(btn => {
      btn.classList.remove('active');
    });
    activeButton.classList.add('active');
  }
}