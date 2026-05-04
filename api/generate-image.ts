// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4
// 缓存 key 使用泰文词汇，确保同一词汇永远命中缓存

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

  if (!tokenResponse.ok) throw new Error(`Token error: ${await tokenResponse.text()}`);
  return (await tokenResponse.json()).access_token;
}

// ✅ 用泰文词汇生成稳定的文件名 key（避免特殊字符问题）
async function thaiToKey(thaiWord: string): Promise<string> {
  const crypto = await import('crypto');
  // 用泰文词汇的 MD5 作为文件名，稳定且唯一
  return 'vocab_' + crypto.createHash('md5').update(thaiWord.trim()).digest('hex');
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
  } catch { return null; }
}

async function saveToCache(accessToken: string, bucket: string, key: string, base64: string): Promise<void> {
  try {
    const imageBuffer = Buffer.from(base64, 'base64');
    const response = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${key}.png`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/png' },
        body: imageBuffer,
      }
    );
    if (response.ok) console.log('[IMG] 💾 Saved to cache:', key);
    else console.warn('[IMG] Cache save failed:', response.status);
  } catch (e: any) { console.warn('[IMG] Cache save error:', e?.message); }
}

function buildAnimalPrompt(prompt: string): string {
  let transformed = prompt
    .replace(/\b(a\s+)?(small|little|young|old|happy|smiling|cheerful|cute|pretty|beautiful|handsome|elderly|Thai|local|primary school|school)(\s+(small|little|young|old|happy|smiling|cheerful|cute|pretty|beautiful|handsome|elderly|Thai|local|primary school|school))*\s+(girl|boy|child|children|kid|kids|baby|toddler|man|woman|men|women|person|people|student|teacher|monk|vendor|farmer|worker|chef|doctor|nurse|mother|father|parent|family|couple|grandfather|grandmother|grandpa|grandma|sister|brother|villager|athlete|soldier|policeman)\b(\s+around\s+\d+(\s+years?\s+old)?)?/gi, 'cartoon animal character')
    .replace(/\b(girl|boy|child|children|kid|kids|baby|toddler|man|woman|men|women|person|people|student|teacher|monk|vendor|farmer|worker|chef|doctor|nurse|mother|father|parent|family|couple|grandfather|grandmother|grandpa|grandma|sister|brother|villager|athlete|soldier|policeman|human|figure)\b/gi, 'cartoon animal character')
    .replace(/\baround\s+\d+(\s*-\s*\d+)?\s*(year[s]?\s+old|yo)\b/gi, '')
    .replace(/\bphotorealistic\b/gi, 'illustrated')
    .replace(/\brealistic\b/gi, 'illustrated')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (transformed.length < 15) transformed = 'cute cartoon animal in a Thai cultural setting';

  return `Kawaii cartoon animal illustration: ${transformed}. Animal characters only, flat vector art style, colorful, Thai cultural aesthetic, sticker art`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, thaiWord } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
  const bucket = process.env.GCS_BUCKET_NAME || 'thailesson-image';

  if (!serviceAccountJson || !projectId) {
    console.error('[IMG] Missing config');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const accessToken = await getAccessToken(serviceAccountJson);

    // ✅ 优先用泰文词汇作为缓存 key，没有则用 prompt MD5
    const cacheKey = thaiWord
      ? await thaiToKey(thaiWord)
      : await (async () => {
          const crypto = await import('crypto');
          return 'prompt_' + crypto.createHash('md5').update(prompt.toLowerCase().trim()).digest('hex');
        })();

    console.log('[IMG] Cache key:', cacheKey, thaiWord ? `(Thai: ${thaiWord})` : '(prompt hash)');

    // 查缓存
    const cached = await getFromCache(accessToken, bucket, cacheKey);
    if (cached) return res.status(200).json({ image: cached, fromCache: true });

    // 生成图片
    const safePrompt = buildAnimalPrompt(prompt);
    console.log('[IMG] Cache miss, generating:', safePrompt.substring(0, 80));

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          instances: [{ prompt: safePrompt }],
          parameters: { sampleCount: 1, aspectRatio: '1:1', safetyFilterLevel: 'block_some', personGeneration: 'dont_allow' },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[IMG] Imagen error:', response.status, err.substring(0, 200));
      if (response.status === 429) return res.status(429).json({ error: 'Quota exceeded' });
      return res.status(response.status).json({ error: 'Image generation failed' });
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64) {
      const reason = data?.predictions?.[0]?.raiFilteredReason;
      console.warn('[IMG] Filtered:', reason?.substring(0, 100) || 'unknown');
      return res.status(500).json({ error: 'No image data', reason });
    }

    // 异步存缓存
    saveToCache(accessToken, bucket, cacheKey, base64);

    console.log('[IMG] ✅ Generated and cached!');
    return res.status(200).json({ image: `data:image/png;base64,${base64}`, fromCache: false });

  } catch (e: any) {
    console.error('[IMG] Error:', e?.message);
    return res.status(500).json({ error: e?.message });
  }
}
