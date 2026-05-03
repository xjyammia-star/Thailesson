import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Gemini API Keys（文字课程生成用，需要暴露到前端）
      'import.meta.env.VITE_GEMINI_API_KEY_1': JSON.stringify(
        env.VITE_GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ""
      ),
      'import.meta.env.VITE_GEMINI_API_KEY_2': JSON.stringify(
        env.VITE_GEMINI_API_KEY_2 || ""
      ),
      'import.meta.env.VITE_GEMINI_API_KEY_3': JSON.stringify(
        env.VITE_GEMINI_API_KEY_3 || ""
      ),
      // 注意：HF_TOKEN 不需要在这里配置
      // 它只在服务器端 api/generate-image.ts 里用 process.env.HF_TOKEN 读取
      // 不会暴露给浏览器，更安全
      'process.env.GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ""
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
