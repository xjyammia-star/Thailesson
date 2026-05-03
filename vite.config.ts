import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      // Gemini API Keys（文字课程生成用）
      'import.meta.env.VITE_GEMINI_API_KEY_1': JSON.stringify(
        env.VITE_GEMINI_API_KEY_1 || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ""
      ),
      'import.meta.env.VITE_GEMINI_API_KEY_2': JSON.stringify(
        env.VITE_GEMINI_API_KEY_2 || ""
      ),
      'import.meta.env.VITE_GEMINI_API_KEY_3': JSON.stringify(
        env.VITE_GEMINI_API_KEY_3 || ""
      ),
      // Hugging Face Token（图片生成用，完全独立不消耗 Gemini 额度）
      'import.meta.env.VITE_HF_TOKEN': JSON.stringify(
        env.VITE_HF_TOKEN || ""
      ),
      // 兼容旧写法
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
