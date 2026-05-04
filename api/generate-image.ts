// api/generate-image.ts
// 使用 Google 服务账号认证调用 Vertex AI Imagen 4

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

// ✅ 清理 prompt 中所有可能触发安全过滤的人物相关词汇
function sanitizePrompt(prompt: string): string {
  // 替换人物相关词汇为物品/场景描述
  const replacements: [RegExp, string][] = [
    // 儿童相关
    [/\b(child|children|kid|kids|boy|girl|baby|toddler|infant|youth|juvenile)\b/gi, ''],
    [/\b(young|little|small)\s+(person|people|student|learner)\b/gi, ''],
    [/Thai\s+child/gi, 'Thai'],
    [/\b\d+\s+year[s]?\s+old\b/gi, ''],
    [/\baround\s+\d+\b/gi, ''],
    // 人物相关
    [/\b(person|people|man|woman|men|women|human|figure|student|teacher|monk)\b/gi, ''],
    [/\b(face|faces|portrait|selfie)\b/gi, ''],
    [/\b(holding|wearing|carrying|eating|drinking|playing|sitting|standing|walking|running)\b/gi, ''],
    // 清理多余空格和逗号
    [/,\s*,/g, ','],
    [/\s{2,}/g, ' '],
    [/^[,\s]+|[,\s]+$/g, ''],
  ];

  let cleaned = prompt;
  for (const [pattern, replacement] of replacements) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  // 确保 prompt 不为空
  if (cleaned.trim().length < 10) {
    cleaned = 'Thai cultural symbol, flat illustration, colorful';
  }

  return cleaned.trim();
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

    // 清理 prompt 并添加安全限制词
    const cleanedPrompt = sanitizePrompt(prompt);
    const safePrompt = `${cleanedPrompt}, no people, no faces, no humans, objects and scenery only, flat illustration style, Thai cultural aesthetic`;

    console.log('[IMG] Original prompt:', prompt.substring(0, 60));
    console.log('[IMG] Safe prompt:', safePrompt.substring(0, 80));

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
