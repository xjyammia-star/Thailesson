// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4
// 带 Google Cloud Storage 缓存：同一词汇只生成一次图片
// 双重策略：先替换人物词汇，再加卡通动物前缀

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

// 所有人物词汇替换为 "cartoon animal character"
function removePeople(prompt: string): string {
  return prompt
    // 带修饰词的人物
    .replace(/\b(a\s+)?(small|little|young|old|happy|smiling|cheerful|cute|pretty|beautiful|handsome|elderly|Thai|local|primary school|school)(\s+(small|little|young|old|happy|smiling|cheerful|cute|pretty|beautiful|handsome|elderly|Thai|local|primary school|school))*\s+(girl|boy|child|children|kid|kids|baby|toddler|man|woman|men|women|person|people|student|teacher|monk|vendor|farmer|worker|chef|doctor|nurse|mother|father|parent|family|couple|grandfather|grandmother|grandpa|grandma|sister|brother|villager|athlete|soldier|policeman)\b/gi, 'cartoon animal character')
    // 单独人物词
    .replace(/\b(girl|boy|child|children|kid|kids|baby|toddler|man|woman|men|women|person|people|student|teacher|monk|vendor|farmer|worker|chef|doctor|nurse|mother|father|parent|family|couple|grandfather|grandmother|grandpa|grandma|sister|brother|villager|athlete|soldier|policeman|human|figure)\b/gi, 'cartoon animal character')
    // 年龄描述
    .replace(/\b\d+\s*(-\s*\d+)?\s*(year[s]?\s+old|yo)\b/gi, '')
    // 画风词替换
    .replace(/\bphotorealistic\b/gi, 'illustrated')
    .replace(/\brealistic\b/gi, 'illustrated')
    .replace(/\b3D render\b/gi, 'flat illustration')
    // 清理多余空格
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildAnimalPrompt(prompt: string): string {
  // 第一步：替换所有人物词汇
  const noPeople = removePeople(prompt);

  // 第二步：加卡通动物前缀，强制风格
  // 注意：避免使用 face/faces/children 等词，即使前面加 no 也可能触发过滤器
  return `Kawaii cartoon animal illustration: ${noPeople}. Animal characters only, flat vector art style, colorful, Thai cultural aesthetic, sticker art`;
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
