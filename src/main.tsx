import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles-system.css'
import './ui/styles-mobile.css'
import { App } from './ui/App'

const assetBase = import.meta.env.BASE_URL
const publicAssetNames = ['growth-field', 'orbit-field', 'soft-haze', 'bubble-field', 'contour-field']

for (const assetName of publicAssetNames) {
  document.documentElement.style.setProperty(
    `--asset-${assetName}`,
    `url("${assetBase}${assetName}.svg")`,
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
