import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, ThaiLesson } from "../types";

// ============================================================
// Doubao API（主要文字生成模型）
// ============================================================

function getDoubaoConfig() {
  return {
    apiKey: (import.meta as any).env?.VITE_DOUBAO_API_KEY || "",
    endpointId: (import.meta as any).env?.VITE_DOUBAO_ENDPOINT_ID || "",
  };
}

async function generateWithDoubao(systemPrompt: string, userPrompt: string): Promise<string> {
  const { apiKey, endpointId } = getDoubaoConfig();

  console.log("[Doubao] API Key prefix:", apiKey?.substring(0, 8) || "EMPTY");
  console.log("[Doubao] Endpoint ID prefix:", endpointId?.substring(0, 10) || "EMPTY");

  if (!apiKey || !endpointId) throw new Error("Doubao not configured");

  let response: Response;
  try {
    response = await fetch(
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: endpointId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no explanation, no code blocks." },
          ],
          response_format: { type: "json_object" },
          max_tokens: 4096,
          temperature: 0.7,
        }),
      }
    );
  } catch (fetchErr: any) {
    console.error("[Doubao] Network fetch error:", fetchErr?.message);
    throw fetchErr;
  }

  console.log("[Doubao] Response status:", response.status);

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Doubao] API error:", response.status, errText);
    throw new Error(`Doubao error ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  console.log("[Doubao] finish_reason:", data?.choices?.[0]?.finish_reason);

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    console.error("[Doubao] No content:", JSON.stringify(data).substring(0, 200));
    throw new Error("No response content from Doubao");
  }
  return text;
}

// ============================================================
// Gemini API Key 管理（备用）
// ============================================================

export function getAvailableKeys(): { index: number; label: string; available: boolean }[] {
  const keys = [
    (import.meta as any).env?.VITE_GEMINI_API_KEY_1 || "",
    (import.meta as any).env?.VITE_GEMINI_API_KEY_2 || "",
    (import.meta as any).env?.VITE_GEMINI_API_KEY_3 || "",
  ];
  return keys.map((key, i) => ({
    index: i + 1,
    label: `Gemini Key ${i + 1}`,
    available: !!key && key.length > 0,
  }));
}

export function isDoubaoAvailable(): boolean {
  const { apiKey, endpointId } = getDoubaoConfig();
  return !!apiKey && !!endpointId;
}

function getGeminiApiKey(keyIndex: number = 1): string {
  const keys: Record<number, string> = {
    1: (import.meta as any).env?.VITE_GEMINI_API_KEY_1 || "",
    2: (import.meta as any).env?.VITE_GEMINI_API_KEY_2 || "",
    3: (import.meta as any).env?.VITE_GEMINI_API_KEY_3 || "",
  };
  return keys[keyIndex] || keys[1] || "";
}

// ============================================================
// 课程生成（优先 Doubao，备用 Gemini）
// ============================================================

export async function generateThaiLesson(
  profile: UserProfile,
  lessonCount: number,
  geminiKeyIndex: number = 0
): Promise<ThaiLesson> {
  const isKid = profile.age === "primary" || profile.age === "middle" || (typeof profile.age === "number" && profile.age < 12);

  const systemInstruction = `You are an expert Thai language teacher. Generate a creative Thai language lesson.

Rules:
1. Audience: ${isKid ? "Children - simple, fun language" : "Adults - professional, engaging"}.
2. Topic: ${profile.topic}.
3. Level: ${profile.age} (primary=elementary school, middle=middle school, high=high school, adult=professional).
4. Always provide exactly 3 exercises.
5. Difficulty ${profile.difficulty}:
   - Foundations: Thai Alphabet ONLY. Lesson ${lessonCount}: next 4 characters. Standard naming (ก=Kor Kai). Specify consonant class.
   - Elementary: Common words, max 6-word sentences.
   - Intermediate: Functional communication, 8-15 word sentences.
   - Advanced: Complex scenarios, 25+ word sentences.
6. Vocabulary: exactly 4 units, DIFFERENT FROM: ${profile.pastVocabulary.join(", ") || "None"}.
   Each unit needs: thai, phonetic, translation, audioText, example{thai,translation}, imagePrompt.
   For alphabet: audioText = full traditional name (e.g. 'ก ไก่').
7. Language for explanations: ${profile.auxiliaryLanguage}.
8. imagePrompt: detailed English description, Thai cultural context, no people.
9. Return valid JSON only matching the exact schema.`;

  const userPrompt = `Generate a ${profile.difficulty} Thai lesson. Index: ${lessonCount}. Focus: ${profile.focus}. Topic: ${profile.topic}. Level: ${profile.age}. Language: ${profile.auxiliaryLanguage}.${profile.difficulty === "Foundations" ? " Sequential alphabet basics." : ""}`;

  // ✅ 优先 Doubao
  if (geminiKeyIndex === 0 && isDoubaoAvailable()) {
    try {
      console.log("[Lesson] Using Doubao Seed 2.0 Lite...");
      const text = await generateWithDoubao(systemInstruction, userPrompt);
      const cleaned = text.replace(/```json|```/g, "").trim();
      console.log("[Lesson] Response length:", cleaned.length);
      console.log("[Lesson] Response preview:", cleaned.substring(0, 300));
      try {
        return JSON.parse(cleaned) as ThaiLesson;
      } catch (parseErr: any) {
        console.error("[Lesson] JSON parse failed:", parseErr.message);
        console.error("[Lesson] Raw text (first 500):", cleaned.substring(0, 500));
        console.error("[Lesson] Raw text (last 200):", cleaned.substring(cleaned.length - 200));
        throw parseErr;
      }
    } catch (e: any) {
      console.error("[Lesson] Doubao failed:", e?.message);
      console.warn("[Lesson] Falling back to Gemini Key 1...");
      geminiKeyIndex = 1;
    }
  }

  // 备用 Gemini
  console.log(`[Lesson] Using Gemini Key ${geminiKeyIndex}...`);
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey(geminiKeyIndex) });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: userPrompt,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          introduction: { type: Type.STRING },
          vocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                thai: { type: Type.STRING }, phonetic: { type: Type.STRING },
                translation: { type: Type.STRING }, audioText: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
                example: { type: Type.OBJECT, properties: { thai: { type: Type.STRING }, translation: { type: Type.STRING } }, required: ["thai", "translation"] },
              },
              required: ["thai", "phonetic", "translation", "example", "imagePrompt", "audioText"],
            },
          },
          content: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { thai: { type: Type.STRING }, translation: { type: Type.STRING } }, required: ["thai", "translation"] } },
          exercise: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.OBJECT, properties: { thai: { type: Type.STRING }, translation: { type: Type.STRING }, imagePrompt: { type: Type.STRING } }, required: ["thai", "translation"] },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: { type: Type.OBJECT, properties: { thai: { type: Type.STRING }, translation: { type: Type.STRING } }, required: ["thai", "translation"] },
              },
              required: ["question", "answer", "explanation"],
            },
          },
          culturalNote: { type: Type.STRING },
        },
        required: ["title", "introduction", "vocabulary", "content", "exercise"],
      },
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text) as ThaiLesson;
}

// ============================================================
// 图片生成（传递泰文词汇作为缓存 key）
// ============================================================

export async function generateImage(prompt: string, thaiWord?: string): Promise<string | null> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, thaiWord }),
    });
    if (!response.ok) {
      if (response.status === 429) return "QUOTA_EXCEEDED";
      return null;
    }
    const data = await response.json();
    return data.image || null;
  } catch (e: any) {
    console.error("[IMG] Error:", e?.message);
    return null;
  }
}

// ============================================================
// 语音（Google Cloud TTS + 内存缓存）
// ============================================================

const audioCache = new Map<string, string>();

export async function generateTTS(text: string): Promise<string | null> {
  if (audioCache.has(text)) return audioCache.get(text)!;
  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.audio) { audioCache.set(text, data.audio); return data.audio; }
    return null;
  } catch (e: any) {
    console.error("[TTS] Error:", e?.message);
    return null;
  }
}

export function playBase64Audio(base64: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
      audio.play();
    } catch (e) { reject(e); }
  });
}

export function speakThai(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { reject(new Error("Not supported")); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH"; utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find((v) => v.lang.startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}
