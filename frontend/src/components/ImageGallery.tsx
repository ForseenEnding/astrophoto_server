import { Image } from 'lucide-react'

export function ImageGallery() {
  return (
    <div className="content-container">
      <div className="section-header">
        <h2 className="section-title">
          <Image size={24} />
          Image Gallery
        </h2>
      </div>
      
      <div className="empty-state">
        <Image size={64} />
        <p>Image Gallery Coming Soon</p>
        <p>View and manage your captured astrophotography images</p>
      </div>
    </div>
  )
}