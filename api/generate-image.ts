// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4
// 策略：把 prompt 中的人物替换成可爱卡通动物，保留动作和场景

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

// 随机选一个可爱的泰国风格卡通动物
function getRandomAnimal(): string {
  const animals = [
    'a cute cartoon elephant',
    'a cute cartoon monkey',
    'a cute cartoon rabbit',
    'a cute cartoon cat',
    'a cute cartoon dog',
    'a cute cartoon bird',
    'a cute cartoon frog',
    'a cute cartoon bear',
  ];
  return animals[Math.floor(Math.random() * animals.length)];
}

// ✅ 把人物替换成卡通动物，保留动作和场景
function buildAnimalPrompt(prompt: string): string {
  const animal = getRandomAnimal();

  // 替换人物词汇为卡通动物
  let transformed = prompt
    // 带年龄描述的人物
    .replace(/\b(a\s+)?(cheerful|happy|smiling|cute|young|little|small)?\s*(Thai\s+)?(child|children|kid|kids|boy|girl|baby|toddler|student|person|people|man|woman|monk)\b(\s+around\s+\d+(\s+years?\s+old)?)?/gi, animal)
    // 单独的人物词
    .replace(/\b(child|children|kid|kids|boy|girl|baby|toddler|student|person|people|man|woman|human|figure|monk)\b/gi, animal)
    // 年龄描述
    .replace(/\baround\s+\d+(\s*-\s*\d+)?\s*(year[s]?\s+old|yo)\b/gi, '')
    // 多余空格
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 如果替换后 prompt 太短或没有意义，构建一个基础 prompt
  if (transformed.length < 15) {
    transformed = `${animal} in a Thai setting`;
  }

  return `${transformed}, cute cartoon style, flat illustration, colorful, Thai cultural aesthetic, no real people, no human faces`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';

  if (!serviceAccountJson || !projectId) {
    console.error('[IMG] Missing GOOGLE_SERVICE_ACCOUNT or GOOGLE_CLOUD_PROJECT');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    console.log('[IMG] Getting access token...');
    const accessToken = await getAccessToken(serviceAccountJson);

    const safePrompt = buildAnimalPrompt(prompt);
    console.log('[IMG] Original:', prompt.substring(0, 60));
    console.log('[IMG] Animal prompt:', safePrompt.substring(0, 80));

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

    console.log('[IMG] ✅ Image generated successfully!');
    return res.status(200).json({ image: `data:image/png;base64,${base64}` });

  } catch (e: any) {
    console.error('[IMG] Error:', e?.message);
    return res.status(500).json({ error: e?.message });
  }
}
