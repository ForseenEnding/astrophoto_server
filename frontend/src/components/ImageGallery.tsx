import { Image } from 'lucide-react'

export function ImageGallery() {
  return (
    <div className="image-gallery">
      <h2>
        <Image className="inline w-6 h-6 mr-2" />
        Image Gallery
      </h2>
      
      <div className="gallery-placeholder">
        <Image className="w-16 h-16 text-gray-400" />
        <p className="text-lg text-gray-600">Image Gallery Coming Soon</p>
        <p className="text-sm text-gray-500">
          View and manage your captured astrophotography images
        </p>
      </div>
    </div>
  )
}