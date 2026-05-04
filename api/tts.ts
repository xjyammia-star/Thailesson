// api/tts.ts
// 服务器端调用 Google Cloud TTS，避免 CORS 问题

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const apiKey = process.env.GOOGLE_TTS_KEY || '';
  if (!apiKey) {
    console.error('[TTS] No GOOGLE_TTS_KEY found');
    return res.status(500).json({ error: 'Server not configured' });
  }

  try {
    console.log('[TTS] Synthesizing:', text.substring(0, 50));

    // 先尝试 Chirp3 HD 高质量语音
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'th-TH',
            name: 'th-TH-Chirp3-HD-Aoede',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.85,
            pitch: 0,
          },
        }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log('[TTS] ✅ Chirp3 HD success');
      return res.status(200).json({ audio: data.audioContent });
    }

    // 降级：使用标准泰语女声
    console.warn('[TTS] Chirp3 HD failed, trying standard voice...');
    const fallback = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'th-TH',
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.85,
          },
        }),
      }
    );

    if (fallback.ok) {
      const data = await fallback.json();
      console.log('[TTS] ✅ Standard voice success');
      return res.status(200).json({ audio: data.audioContent });
    }

    const err = await fallback.text();
    console.error('[TTS] Both voices failed:', err);
    return res.status(500).json({ error: 'TTS failed' });

  } catch (e: any) {
    console.error('[TTS] Error:', e?.message);
    return res.status(500).json({ error: e?.message });
  }
}
