// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4
// 带 Google Cloud Storage 缓存：同一词汇只生成一次图片

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
    'a cute cartoon panda',
    'a cute cartoon tiger',
  ];
  return animals[Math.floor(Math.random() * animals.length)];
}

function getRandomAnimalGroup(): string {
  const groups = [
    'a cute cartoon animal family',
    'cute cartoon animals together',
    'a group of cute cartoon animals',
    'cute cartoon forest animals',
  ];
  return groups[Math.floor(Math.random() * groups.length)];
}

function buildAnimalPrompt(prompt: string): string {
  let transformed = prompt;

  // ✅ 替换家庭/群体词汇（用动物群体）
  transformed = transformed.replace(
    /\b(Thai\s+)?(family|families|couple|parents?|mother|father|mom|dad|sister|brother|siblings?|grandma|grandpa|grandfather|grandmother|ancestor|relative|villager[s]?)\b/gi,
    getRandomAnimalGroup()
  );

  // 替换单个人物词汇（用单个动物）
  const animal = getRandomAnimal();
  transformed = transformed
    .replace(/\b(a\s+)?(cheerful|happy|smiling|cute|young|little|small|old|elderly|pretty|handsome|beautiful)?\s*(Thai\s+)?(child|children|kid|kids|boy|girl|baby|toddler|student|person|people|man|woman|men|women|monk|teacher|vendor|seller|farmer|worker|chef|doctor|nurse|soldier|policeman|athlete)\b(\s+around\s+\d+(\s+years?\s+old)?)?/gi, animal)
    .replace(/\b(child|children|kid|kids|boy|girl|baby|toddler|student|person|people|man|woman|men|women|human|figure|monk|teacher|vendor|seller|farmer|worker|chef|doctor|nurse)\b/gi, animal)
    .replace(/\baround\s+\d+(\s*-\s*\d+)?\s*(year[s]?\s+old|yo)\b/gi, '')
    // 替换 "his/her/their" 等人称代词
    .replace(/\b(his|her|their|him|them|they|he|she)\b/gi, 'its')
    // 替换 photorealistic 为 cartoon（避免真实人脸风格）
    .replace(/\bphotorealistic\b/gi, 'cartoon illustration')
    .replace(/\brealistic\b/gi, 'illustrated')
    .replace(/\s{2,}/g, ' ')
    .trim();

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
    console.log('[IMG] Cache miss, generating:', safePrompt.substring(0, 80));

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
