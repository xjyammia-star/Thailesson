import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Gemini API Keys（备用）
      'import.meta.env.VITE_GEMINI_API_KEY_1': JSON.stringify(
        env.VITE_GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ""
      ),
      'import.meta.env.VITE_GEMINI_API_KEY_2': JSON.stringify(env.VITE_GEMINI_API_KEY_2 || ""),
      'import.meta.env.VITE_GEMINI_API_KEY_3': JSON.stringify(env.VITE_GEMINI_API_KEY_3 || ""),
      // ✅ Doubao API — 读取带 VITE_ 前缀的变量（与 Vercel 设置一致）
      'import.meta.env.VITE_DOUBAO_API_KEY': JSON.stringify(env.VITE_DOUBAO_API_KEY || ""),
      'import.meta.env.VITE_DOUBAO_ENDPOINT_ID': JSON.stringify(env.VITE_DOUBAO_ENDPOINT_ID || ""),
      // 兼容旧写法
      'process.env.GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ""
      ),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
