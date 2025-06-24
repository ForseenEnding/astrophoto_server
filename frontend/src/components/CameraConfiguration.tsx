import { Save, Settings } from 'lucide-react'
import { useState } from 'react'
import { ConfigurationGroups } from './ConfigurationGroups'
import { PresetManager } from './PresetManager'

export function CameraConfiguration() {
  const [activeTab, setActiveTab] = useState<'config' | 'presets'>('config')

  return (
    <div className="camera-configuration">
      <div className="config-header">
        <h2>
          <Settings className="inline w-6 h-6 mr-2" />
          Camera Configuration
        </h2>
        
        <div className="config-tabs">
          <button
            onClick={() => setActiveTab('config')}
            className={`btn ${activeTab === 'config' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`btn ${activeTab === 'presets' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Save className="w-4 h-4 mr-2" />
            Presets
          </button>
        </div>
      </div>

      <div className="config-content">
        {activeTab === 'config' ? (
          <ConfigurationGroups />
        ) : (
          <PresetManager />
        )}
      </div>
    </div>
  )
}