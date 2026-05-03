// api/generate-image.ts
// 这个文件运行在 Vercel 服务器端，不在浏览器里
// 所以不会有 CORS 问题，可以自由调用 Hugging Face API

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  // HF Token 从服务器环境变量读取，不暴露给前端
  const hfToken = process.env.HF_TOKEN || process.env.VITE_HF_TOKEN || "";

  if (!hfToken) {
    console.error("[API] No HF_TOKEN found in environment variables");
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    console.log("[API] Generating image for prompt:", prompt.substring(0, 60));

    const response = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 4,
            width: 512,
            height: 512,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API] HF error:", response.status, errorText);

      if (response.status === 503) {
        // 模型冷启动中，告诉前端跳过
        return res.status(503).json({ error: 'Model loading' });
      }
      if (response.status === 429) {
        return res.status(429).json({ error: 'Quota exceeded' });
      }
      return res.status(response.status).json({ error: errorText });
    }

    // 把图片数据转成 base64 返回给前端
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    console.log("[API] ✅ Image generated successfully");
    return res.status(200).json({ image: dataUrl });

  } catch (e: any) {
    console.error("[API] Fetch error:", e?.message);
    return res.status(500).json({ error: e?.message || 'Unknown error' });
  }
}