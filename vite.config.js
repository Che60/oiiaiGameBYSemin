// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // base 경로를 상대경로로 설정
  root: '.',  // index.html이 루트에 있다면 이대로
  build: {
    rollupOptions: {
      input: './index.html',
    },
  },
})
