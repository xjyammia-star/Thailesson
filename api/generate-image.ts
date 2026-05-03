// api/generate-image.ts
// Vercel Serverless Function - 服务器端运行，解决 CORS 问题

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const hfToken = process.env.HF_TOKEN || "";
  if (!hfToken) {
    console.error("[API] No HF_TOKEN found");
    return res.status(500).json({ error: 'Server not configured' });
  }

  // 依次尝试多个模型，直到成功为止
  const models = [
    "stabilityai/stable-diffusion-xl-base-1.0",
    "runwayml/stable-diffusion-v1-5",
    "CompVis/stable-diffusion-v1-4",
  ];

  for (const model of models) {
    try {
      console.log(`[API] Trying model: ${model}`);

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${model}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              num_inference_steps: 20,
              width: 512,
              height: 512,
            },
            options: {
              wait_for_model: true,  // 等待模型加载，不报 503
            }
          }),
        }
      );

      console.log(`[API] ${model} response status:`, response.status);

      if (response.status === 429) {
        return res.status(429).json({ error: 'Quota exceeded' });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[API] ${model} failed:`, response.status, errorText.substring(0, 200));
        continue; // 尝试下一个模型
      }

      // 检查返回的是不是图片（有时候会返回 JSON 错误）
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image')) {
        const text = await response.text();
        console.warn(`[API] ${model} returned non-image:`, text.substring(0, 200));
        continue;
      }

      // 成功！转成 base64 返回
      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      console.log(`[API] ✅ Success with model: ${model}`);
      return res.status(200).json({ image: dataUrl });

    } catch (e: any) {
      console.warn(`[API] ${model} error:`, e?.message);
      continue;
    }
  }

  // 所有模型都失败了
  console.error("[API] All models failed");
  return res.status(500).json({ error: 'All image models failed' });
}
