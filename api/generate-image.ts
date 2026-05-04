// api/generate-image.ts
// 服务器端调用 Google Imagen 4 生成图片
// 通过 Vertex AI REST API 调用

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const apiKey = process.env.GOOGLE_TTS_KEY || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';

  if (!apiKey || !projectId) {
    console.error('[IMG] Missing GOOGLE_TTS_KEY or GOOGLE_CLOUD_PROJECT');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    console.log('[IMG] Generating image for:', prompt.substring(0, 60));

    // 使用 Imagen 4 Fast（最便宜，$0.02/张，速度快）
    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-preview-06-06:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            safetyFilterLevel: 'block_some',
            personGeneration: 'allow_adult',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[IMG] Imagen API error:', response.status, err.substring(0, 300));

      if (response.status === 429) {
        return res.status(429).json({ error: 'Quota exceeded' });
      }
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64) {
      console.warn('[IMG] No image data in response');
      return res.status(500).json({ error: 'No image data' });
    }

    const dataUrl = `data:image/png;base64,${base64}`;
    console.log('[IMG] ✅ Image generated successfully');
    return res.status(200).json({ image: dataUrl });

  } catch (e: any) {
    console.error('[IMG] Error:', e?.message);
    return res.status(500).json({ error: e?.message });
  }
}
