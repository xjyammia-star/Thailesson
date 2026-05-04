// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4
// 带 Google Cloud Storage 缓存：同一词汇只生成一次图片
// 所有图片强制使用卡通动物风格，避免人物过滤

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerPayload = `${encode(header)}.${encode(payload)}`;
  const crypto = await import('crypto');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(headerPayload);
  const signature = sign.sign(sa.private_key, 'base64url');
  const jwt = `${headerPayload}.${signature}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${err}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function promptToKey(prompt: string): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('md5').update(prompt.toLowerCase().trim()).digest('hex');
}

async function getFromCache(accessToken: string, bucket: string, key: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${key}.png?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    console.log('[IMG] ✅ Cache hit:', key);
    return `data:image/png;base64,${base64}`;
  } catch {
    return null;
  }
}

async function saveToCache(accessToken: string, bucket: string, key: string, base64: string): Promise<void> {
  try {
    const imageBuffer = Buffer.from(base64, 'base64');
    const response = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${key}.png`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      }
    );
    if (response.ok) {
      console.log('[IMG] 💾 Saved to cache:', key);
    } else {
      const err = await response.text();
      console.warn('[IMG] Cache save failed:', err.substring(0, 100));
    }
  } catch (e: any) {
    console.warn('[IMG] Cache save error:', e?.message);
  }
}

// ✅ 核心策略：不管原始 prompt 是什么内容，
// 统一用卡通动物角色风格包装，从根本上避免人物过滤
function buildAnimalPrompt(prompt: string): string {
  // 提取原始 prompt 的核心概念（去掉画风描述词，保留主题）
  const cleanedPrompt = prompt
    .replace(/\bphotorealistic\b/gi, '')
    .replace(/\bhigh.quality\b/gi, '')
    .replace(/\b3D render\b/gi, '')
    .replace(/\bprofessional photo\b/gi, '')
    .replace(/\bscenic\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 强制前缀：卡通动物角色风格
  // 这个前缀会覆盖所有人物描述，因为 Imagen 会优先遵循开头的风格指令
  return `Cute cartoon animal characters illustration style: ${cleanedPrompt}. All characters must be cartoon animals (elephant, rabbit, cat, dog, bear, etc.), no real humans, no real faces, no children, kawaii flat illustration, colorful, Thai cultural elements, white background`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
  const bucket = process.env.GCS_BUCKET_NAME || 'thailesson-image';

  if (!serviceAccountJson || !projectId) {
    console.error('[IMG] Missing GOOGLE_SERVICE_ACCOUNT or GOOGLE_CLOUD_PROJECT');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    console.log('[IMG] Getting access token...');
    const accessToken = await getAccessToken(serviceAccountJson);

    // 先查缓存
    const cacheKey = await promptToKey(prompt);
    const cached = await getFromCache(accessToken, bucket, cacheKey);
    if (cached) {
      return res.status(200).json({ image: cached, fromCache: true });
    }

    // 缓存未命中，生成图片
    const safePrompt = buildAnimalPrompt(prompt);
    console.log('[IMG] Cache miss, generating:', safePrompt.substring(0, 100));

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          instances: [{ prompt: safePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '1:1',
            safetyFilterLevel: 'block_some',
            personGeneration: 'dont_allow',
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[IMG] Imagen error:', response.status, err.substring(0, 300));
      if (response.status === 429) return res.status(429).json({ error: 'Quota exceeded' });
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64) {
      const filteredReason = data?.predictions?.[0]?.raiFilteredReason;
      console.warn('[IMG] No image data. Filter reason:', filteredReason || 'unknown');
      return res.status(500).json({ error: 'No image data', reason: filteredReason });
    }

    // 存入缓存（异步）
    saveToCache(accessToken, bucket, cacheKey, base64);

    console.log('[IMG] ✅ Image generated and cached!');
    return res.status(200).json({ image: `data:image/png;base64,${base64}`, fromCache: false });

  } catch (e: any) {
    console.error('[IMG] Error:', e?.message);
    return res.status(500).json({ error: e?.message });
  }
}
