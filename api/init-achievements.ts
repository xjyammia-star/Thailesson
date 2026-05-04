// api/init-achievements.ts
// 一次性批量生成全部成就图片并存入 GCS
// 访问 /api/init-achievements 触发，生成完成后不再需要

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

async function generateAndSave(
  accessToken: string,
  projectId: string,
  bucket: string,
  filename: string,
  prompt: string
): Promise<{ success: boolean; filename: string; error?: string }> {
  try {
    // 检查是否已经存在
    const checkResponse = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${filename}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkResponse.ok) {
      console.log(`[INIT] Already exists, skipping: ${filename}`);
      return { success: true, filename, error: 'already exists' };
    }

    // 生成图片
    console.log(`[INIT] Generating: ${filename}`);
    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/imagen-4.0-fast-generate-001:predict`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
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
      return { success: false, filename, error: `Imagen error ${response.status}: ${err.substring(0, 100)}` };
    }

    const data = await response.json();
    const base64 = data?.predictions?.[0]?.bytesBase64Encoded;
    if (!base64) {
      const reason = data?.predictions?.[0]?.raiFilteredReason || 'unknown';
      return { success: false, filename, error: `Filtered: ${reason.substring(0, 100)}` };
    }

    // 存入 GCS
    const imageBuffer = Buffer.from(base64, 'base64');
    const uploadResponse = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${filename}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'image/png',
        },
        body: imageBuffer,
      }
    );

    if (!uploadResponse.ok) {
      return { success: false, filename, error: `Upload failed: ${uploadResponse.status}` };
    }

    console.log(`[INIT] ✅ Saved: ${filename}`);
    return { success: true, filename };

  } catch (e: any) {
    return { success: false, filename, error: e?.message };
  }
}

// ✅ 每个成就的真实场景 prompt，确保地理和文化准确
const ACHIEVEMENT_PROMPTS: { id: string; filename: string; prompt: string }[] = [
  {
    id: 'bkk',
    filename: 'achievement_bkk.png',
    prompt: 'The Grand Palace Bangkok Thailand, golden spires and ornate Thai architecture, Wat Phra Kaew temple complex, emerald green rooftops with gold details, blue sky, professional travel photography, ultra detailed, no people'
  },
  {
    id: 'aya',
    filename: 'achievement_aya.png',
    prompt: 'Ancient stone Buddha head entwined in banyan tree roots at Wat Mahathat Ayutthaya Thailand, serene stone face wrapped by large tree roots, ancient red brick ruins surrounding, UNESCO world heritage site, golden hour lighting, no people'
  },
  {
    id: 'kcn',
    filename: 'achievement_kcn.png',
    prompt: 'Bridge over the River Kwai Kanchanaburi Thailand, historic black iron railway bridge spanning wide green river, lush jungle hills in background, reflection in calm water, classic World War II landmark, no people'
  },
  {
    id: 'lpb',
    filename: 'achievement_lpb.png',
    prompt: 'Phra Prang Sam Yod Lopburi Thailand, three ancient Khmer stone towers with carved decorations, monkeys sitting on the ruins, golden stone texture, sunny day with blue sky, historical landmark, no people'
  },
  {
    id: 'pkt',
    filename: 'achievement_pkt.png',
    prompt: 'Phuket Old Town Sino-Portuguese architecture Thailand, colorful pastel shophouses with ornate facades, blue and yellow painted buildings, narrow street lined with historical buildings, Chinese lanterns hanging, tropical plants, no people'
  },
  {
    id: 'samui',
    filename: 'achievement_samui.png',
    prompt: 'Big Buddha temple Koh Samui Thailand, giant golden seated Buddha statue on small island connected by causeway, surrounded by calm blue sea, clear tropical sky, golden statue gleaming in sunlight, no people'
  },
  {
    id: 'cnx',
    filename: 'achievement_cnx.png',
    prompt: 'Wat Phra That Doi Suthep Chiang Mai Thailand, golden chedi pagoda on mountaintop surrounded by misty forested mountains, ornate golden spire against blue sky, mountain temple in northern Thailand, no people'
  },
  {
    id: 'skh',
    filename: 'achievement_skh.png',
    prompt: 'Wat Si Chum Sukhothai Thailand, massive stone seated Buddha statue inside narrow stone enclosure, giant ancient Buddha face visible through narrow opening in thick stone walls, golden afternoon light, Sukhothai historical park, no people'
  },
  {
    id: 'kbi',
    filename: 'achievement_kbi.png',
    prompt: 'Railay Beach Krabi Thailand, dramatic limestone karst cliffs rising from turquoise sea, pristine white sand beach surrounded by towering rock formations, clear emerald water, tropical paradise, no people'
  },
  {
    id: 'loe',
    filename: 'achievement_loe.png',
    prompt: 'Phi Ta Khon ghost festival mask Loei Thailand, colorful handmade traditional ghost mask with elongated nose, vivid red and yellow painted patterns, traditional woven rattan base, close up detail shot, Thai folk art, no people'
  },
];

export default async function handler(req: any, res: any) {
  // 允许 GET 请求直接触发
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || '';
  const bucket = process.env.GCS_BUCKET_NAME || 'thailesson-image';

  if (!serviceAccountJson || !projectId) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    const accessToken = await getAccessToken(serviceAccountJson);
    const results = [];

    // 逐个生成，每张间隔 2 秒避免超出速率限制
    for (const item of ACHIEVEMENT_PROMPTS) {
      const result = await generateAndSave(accessToken, projectId, bucket, item.filename, item.prompt);
      results.push(result);
      // 间隔 2 秒
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success);

    return res.status(200).json({
      message: `Done! ${succeeded}/${ACHIEVEMENT_PROMPTS.length} images generated.`,
      results,
      failed: failed.length > 0 ? failed : undefined,
    });

  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
}
