import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { bootstrap } from './store'

// 서버가 있는지 확인하고 로그인 상태를 불러온다. 끝나기 전에는 App 이 "불러오는 중"을 보여준다.
void bootstrap()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
