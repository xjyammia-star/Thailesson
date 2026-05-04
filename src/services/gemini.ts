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

// ✅ 明确的 JSON schema，强制 Doubao 遵循正确结构
const JSON_SCHEMA_INSTRUCTION = `
You MUST return a JSON object with EXACTLY these fields (no other field names):
{
  "title": "string - lesson title",
  "introduction": "string - lesson introduction",
  "vocabulary": [
    {
      "thai": "string - Thai word or character",
      "phonetic": "string - romanized pronunciation",
      "translation": "string - meaning in target language",
      "audioText": "string - text for TTS (full traditional name for alphabet)",
      "imagePrompt": "string - English image description",
      "example": {
        "thai": "string - example sentence in Thai",
        "translation": "string - translation of example"
      }
    }
  ],
  "content": [
    {
      "thai": "string - Thai sentence",
      "translation": "string - translation"
    }
  ],
  "exercise": [
    {
      "question": {
        "thai": "string - question in Thai",
        "translation": "string - question translation",
        "imagePrompt": "string - optional image description"
      },
      "options": ["string", "string", "string", "string"],
      "answer": "string - correct answer",
      "explanation": {
        "thai": "string - explanation in Thai",
        "translation": "string - explanation translation"
      }
    }
  ],
  "culturalNote": "string - cultural note"
}

CRITICAL RULES:
- Use EXACTLY these field names: title, introduction, vocabulary, content, exercise, culturalNote
- vocabulary must have EXACTLY 4 items
- exercise must have EXACTLY 3 items
- Do NOT use any other field names like lessonTitle, audience, foundations, etc.
- Return ONLY the JSON object, no markdown, no explanation
`;

async function generateWithDoubao(systemPrompt: string, userPrompt: string): Promise<string> {
  const { apiKey, endpointId } = getDoubaoConfig();

  if (!apiKey || !endpointId) throw new Error("Doubao not configured");

  const response = await fetch(
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
          { role: "system", content: systemPrompt + "\n\n" + JSON_SCHEMA_INSTRUCTION },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Doubao error ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response content from Doubao");
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
4. Always provide exactly 3 exercises with multiple choice options.
5. Difficulty ${profile.difficulty}:
   - Foundations: Thai Alphabet ONLY. Lesson ${lessonCount}: next 4 characters. Standard naming (ก=Kor Kai). Specify consonant class.
   - Elementary: Common words, max 6-word sentences.
   - Intermediate: Functional communication, 8-15 word sentences.
   - Advanced: Complex scenarios, 25+ word sentences.
6. Vocabulary: exactly 4 units, DIFFERENT FROM: ${profile.pastVocabulary.join(", ") || "None"}.
   For alphabet: audioText = full traditional name (e.g. 'ก ไก่').
7. Language for explanations: ${profile.auxiliaryLanguage}.
8. imagePrompt: detailed English description, Thai cultural context, no people.`;

  const userPrompt = `Generate a ${profile.difficulty} Thai lesson. Index: ${lessonCount}. Focus: ${profile.focus}. Topic: ${profile.topic}. Level: ${profile.age}. Language: ${profile.auxiliaryLanguage}.${profile.difficulty === "Foundations" ? " Sequential alphabet basics." : ""}`;

  // ✅ 优先 Doubao
  if (geminiKeyIndex === 0 && isDoubaoAvailable()) {
    try {
      console.log("[Lesson] Using Doubao Seed 2.0 Lite...");
      const text = await generateWithDoubao(systemInstruction, userPrompt);
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as ThaiLesson;

      // ✅ 验证关键字段是否存在
      if (!parsed.title || !parsed.vocabulary || !parsed.exercise) {
        console.error("[Lesson] Invalid structure, missing fields:", Object.keys(parsed));
        throw new Error("Invalid lesson structure from Doubao");
      }

      console.log("[Lesson] ✅ Doubao success, title:", parsed.title);
      return parsed;
    } catch (e: any) {
      console.error("[Lesson] Doubao failed:", e?.message);
      console.warn("[Lesson] Falling back to Gemini...");
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
