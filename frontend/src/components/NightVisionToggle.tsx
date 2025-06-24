import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

export function NightVisionToggle() {
  const [isNightMode, setIsNightMode] = useState(() => {
    // Check localStorage for saved preference
    const saved = localStorage.getItem('nightVisionMode')
    return saved ? JSON.parse(saved) : true // Default to night mode
  })

  useEffect(() => {
    // Save preference to localStorage
    localStorage.setItem('nightVisionMode', JSON.stringify(isNightMode))
    
    // Apply theme to document root
    const root = document.documentElement
    
    if (isNightMode) {
      root.classList.add('night-vision-mode')
      root.classList.remove('normal-mode')
    } else {
      root.classList.add('normal-mode')
      root.classList.remove('night-vision-mode')
    }
  }, [isNightMode])

  const toggleMode = () => {
    setIsNightMode((prev: boolean): boolean => !prev)
  }

  return (
    <button
      onClick={toggleMode}
      className={`night-vision-toggle ${isNightMode ? 'active' : ''}`}
      title={isNightMode ? 'Switch to Normal Mode' : 'Switch to Night Vision Mode'}
    >
      {isNightMode ? (
        <>
          <Moon className="w-4 h-4 mr-2" />
          Night Mode
        </>
      ) : (
        <>
          <Sun className="w-4 h-4 mr-2" />
          Normal Mode
        </>
      )}
    </button>
  )
}