import React from 'react'
import ReactDOM from 'react-dom/client'
import RussianReadAloudDemo from './RussianReadAloud'
import './style.css'

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <RussianReadAloudDemo />
  </React.StrictMode>,
)
