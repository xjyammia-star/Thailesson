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

async function generateWithDoubao(
  systemPrompt: string,
  userPrompt: string,
  schema: object
): Promise<string> {
  const { apiKey, endpointId } = getDoubaoConfig();

  if (!apiKey || !endpointId) {
    throw new Error("Doubao API key or endpoint ID not configured");
  }

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
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              userPrompt +
              "\n\nIMPORTANT: Respond ONLY with valid JSON matching the schema. No markdown, no explanation.",
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0.7,
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Doubao API error ${response.status}: ${err.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from Doubao");
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

function getGeminiInstance(keyIndex: number = 1) {
  return new GoogleGenAI({ apiKey: getGeminiApiKey(keyIndex) });
}

// ============================================================
// 课程生成（优先 Doubao，备用 Gemini）
// ============================================================

export async function generateThaiLesson(
  profile: UserProfile,
  lessonCount: number,
  geminiKeyIndex: number = 0 // 0 = 使用 Doubao，1/2/3 = 使用对应 Gemini Key
): Promise<ThaiLesson> {
  const isKid =
    profile.age === "primary" ||
    profile.age === "middle" ||
    (typeof profile.age === "number" && profile.age < 12);

  const systemInstruction = `
    You are an expert Thai language teacher. 
    Task: Generate a creative Thai language lesson.
    
    Constraints:
    1. Audience: ${isKid ? "Children (use simple, fun language)" : "Adults (use professional, engaging language)"}.
    2. Topic: ${profile.topic}.
    3. Education Level:
       - Current Level: ${profile.age}.
       - primary: Thai Elementary School curriculum, basic phonics, daily life vocabulary.
       - middle: Middle School, classroom objects, simple social interactions.
       - high: High School, abstract concepts, formal grammar.
       - adult: Professional, travel, or practical life scenarios.
    4. Always provide exactly 3 interactive exercises.
    5. Difficulty:
       - Foundations: Thai Alphabet ONLY. Lesson ${lessonCount}: next set of 4 characters. Use standard naming (e.g. ก = Kor Kai). Specify consonant class.
       - Elementary: Common words, basic grammar, max 6-word sentences.
       - Intermediate: Functional communication, 8-15 word sentences.
       - Advanced: Complex scenarios, 25+ word sentences.
    6. Content:
       - Exactly 4 vocabulary units, DIFFERENT FROM: ${profile.pastVocabulary.join(", ") || "None"}.
       - Each unit: thai, phonetic, translation, audioText, example (thai + translation), imagePrompt.
       - For alphabet: audioText = full traditional name (e.g. 'ก ไก่').
    7. Language: Use ${profile.auxiliaryLanguage} for all explanations.
    8. imagePrompt: detailed English description, Thai cultural context.
    9. Return valid JSON only.
  `;

  const userPrompt = `Generate a ${profile.difficulty} Thai lesson.
    Lesson Index: ${lessonCount}.
    Focus: ${profile.focus} skills.
    Topic: ${profile.topic}.
    Student age/level: ${profile.age ?? "any"}.
    Language: ${profile.auxiliaryLanguage}.
    ${profile.difficulty === "Foundations" ? "Start with alphabet/pronunciation basics sequentially." : ""}`;

  const schema = {
    type: "object",
    properties: {
      title: { type: "string" },
      introduction: { type: "string" },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          properties: {
            thai: { type: "string" },
            phonetic: { type: "string" },
            translation: { type: "string" },
            example: {
              type: "object",
              properties: {
                thai: { type: "string" },
                translation: { type: "string" },
              },
            },
            audioText: { type: "string" },
            imagePrompt: { type: "string" },
          },
        },
      },
      content: {
        type: "array",
        items: {
          type: "object",
          properties: {
            thai: { type: "string" },
            translation: { type: "string" },
          },
        },
      },
      exercise: {
        type: "array",
        items: {
          type: "object",
          properties: {
            question: {
              type: "object",
              properties: {
                thai: { type: "string" },
                translation: { type: "string" },
                imagePrompt: { type: "string" },
              },
            },
            options: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            explanation: {
              type: "object",
              properties: {
                thai: { type: "string" },
                translation: { type: "string" },
              },
            },
          },
        },
      },
      culturalNote: { type: "string" },
    },
  };

  // ✅ 优先使用 Doubao（geminiKeyIndex === 0）
  if (geminiKeyIndex === 0 && isDoubaoAvailable()) {
    try {
      console.log("[Lesson] Using Doubao Seed 2.0 Lite...");
      const text = await generateWithDoubao(systemInstruction, userPrompt, schema);
      const cleaned = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleaned) as ThaiLesson;
    } catch (e: any) {
      console.warn("[Lesson] Doubao failed, falling back to Gemini Key 1:", e?.message);
      // 自动降级到 Gemini Key 1
      geminiKeyIndex = 1;
    }
  }

  // 使用 Gemini（备用）
  console.log(`[Lesson] Using Gemini Key ${geminiKeyIndex}...`);
  const ai = getGeminiInstance(geminiKeyIndex);

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
                thai: { type: Type.STRING },
                phonetic: { type: Type.STRING },
                translation: { type: Type.STRING },
                example: {
                  type: Type.OBJECT,
                  properties: {
                    thai: { type: Type.STRING },
                    translation: { type: Type.STRING },
                  },
                  required: ["thai", "translation"],
                },
                audioText: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
              },
              required: ["thai", "phonetic", "translation", "example", "imagePrompt", "audioText"],
            },
          },
          content: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                thai: { type: Type.STRING },
                translation: { type: Type.STRING },
              },
              required: ["thai", "translation"],
            },
          },
          exercise: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: {
                  type: Type.OBJECT,
                  properties: {
                    thai: { type: Type.STRING },
                    translation: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                  },
                  required: ["thai", "translation"],
                },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: {
                  type: Type.OBJECT,
                  properties: {
                    thai: { type: Type.STRING },
                    translation: { type: Type.STRING },
                  },
                  required: ["thai", "translation"],
                },
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
// 图片生成（通过 Vercel 服务器端）
// ============================================================

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[IMG] API error:", response.status, errorData);
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
// 语音（Google Cloud TTS，带内存缓存）
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
    if (data.audio) {
      audioCache.set(text, data.audio);
      return data.audio;
    }
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
    } catch (e) {
      reject(e);
    }
  });
}

export function speakThai(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { reject(new Error("Not supported")); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find((v) => v.lang.startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}

export async function generateAudio(text: string): Promise<string | null> {
  try { await speakThai(text); return "WEB_SPEECH_PLAYED"; }
  catch (e) { return null; }
}
