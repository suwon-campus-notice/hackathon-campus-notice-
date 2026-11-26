import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// base './' : 배포 주소 앞에 경로가 붙어도(예: /아이디/) 정적 파일을 찾을 수 있게 한다.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node' },
})
