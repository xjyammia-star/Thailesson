import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, ThaiLesson } from "../types";

// ============================================================
// API Key 管理
// ============================================================

export function getAvailableKeys(): { index: number; label: string; available: boolean }[] {
  const keys = [
    (import.meta as any).env?.VITE_GEMINI_API_KEY_1 || "",
    (import.meta as any).env?.VITE_GEMINI_API_KEY_2 || "",
    (import.meta as any).env?.VITE_GEMINI_API_KEY_3 || "",
  ];
  return keys.map((key, i) => ({
    index: i + 1,
    label: `Key ${i + 1}`,
    available: !!key && key.length > 0,
  }));
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
// 文字课程生成（Gemini 2.5 Flash）
// ============================================================

export async function generateThaiLesson(
  profile: UserProfile,
  lessonCount: number,
  keyIndex: number = 1
): Promise<ThaiLesson> {
  const isKid = profile.age === 'primary' || profile.age === 'middle' || (typeof profile.age === 'number' && profile.age < 12);
  const ai = getGeminiInstance(keyIndex);

  const systemInstruction = `
    You are an expert Thai language teacher. 
    Task: Generate a creative Thai language lesson.
    
    Constraints:
    1. Audience: ${isKid ? 'Children (use simple, fun language, matching educational age)' : 'Adults (use professional, engaging language)'}.
    2. Topic: ${profile.topic}.
    3. Education Level Context:
       - Current Level: ${profile.age}.
       - CURRICULUM MATCHING: 
         * IF Level is 'primary': Match Thai Elementary School curriculum (OBEC standard Grade 1-6). Focus on basic phonics (Kor Kai, etc.), daily life (family, school, play), and high-frequency childhood vocabulary.
         * IF Level is 'middle': Match Middle School curriculum. Focus on classroom objects, simple social interactions, hobbies, and basic sentence patterns.
         * IF Level is 'high': Match High School curriculum. Focus on more abstract concepts, social issues, future planning, and formal grammar.
         * IF Level is 'adult': Focus on professional, travel, or practical life scenarios.
    4. Exercises: Always provide exactly 3 interactive exercises per lesson.
    5. Difficulty Scaling & Logic: 
       - IF Difficulty is 'Foundations': 
         * Focus EXCLUSIVELY on the Thai Alphabet (Consonants, Vowels) and Tones.
         * Use the user's Topic (${profile.topic}) to create creative mnemonics.
         * Lesson ${lessonCount}: Focus on the next set of 4 characters or a specific phonetic concept.
         * IMPORTANT: For characters, use the standard naming convention (e.g., 'ก' is 'Kor Kai').
         * PHONETIC ACCURACY: Must specify if it's Mid, High, or Low class consonant.
         * Sentence Length: Use only individual letters or very simple 2-syllable pairings.
       - IF Difficulty is 'Elementary': 
         * Focus on common words and basic grammar.
         * Sentence Length: Short, simple sentences (max 6 words).
       - IF Difficulty is 'Intermediate': 
         * Focus on functional communication.
         * Sentence Length: Moderate length (8-15 words) with standard conjunctions.
       - IF Difficulty is 'Advanced': 
         * Focus on complex scenarios based on ${profile.topic}.
         * Sentence Length: Long, sophisticated sentences (at least 25 words).
    5. Content: 
       - Exactly 4 vocabulary units.
       - UNITS MUST BE DIFFERENT FROM: ${profile.pastVocabulary.join(', ') || 'None'}.
       - Each unit must have: thai, phonetic, translation, audioText, and example (thai + translation). 
       - For characters: 
         * 'thai': The character itself (e.g., ก).
         * 'phonetic': Standard name + Class (e.g., Kor Kai [Mid class]).
         * 'translation': The meaning of the companion object (e.g., Chicken).
         * 'audioText': The TRADITIONAL FULL NAME for TTS (e.g., 'ก ไก่').
    6. Language: Use ${profile.auxiliaryLanguage} for all explanations and translations.
    7. Formatting: Return JSON according to the specified schema.
    8. Vocabulary Image Prompts: For each word, provide a detailed English 'imagePrompt' (photorealistic, Thai context).
    9. Conciseness: Keep the lesson focused.
  `;

  const prompt = `Generate a ${profile.difficulty} Thai lesson.
    Lesson Index: ${lessonCount}.
    Focus: ${profile.focus} skills. 
    Topic: ${profile.topic}.
    Student age: ${profile.age ?? 'any'}. 
    Language: ${profile.auxiliaryLanguage}.
    ${profile.difficulty === 'Foundations' ? 'Start with alphabet/pronunciation basics sequentially.' : ''}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
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
                    translation: { type: Type.STRING }
                  },
                  required: ["thai", "translation"]
                },
                audioText: { type: Type.STRING },
                imagePrompt: { type: Type.STRING }
              },
              required: ["thai", "phonetic", "translation", "example", "imagePrompt", "audioText"]
            }
          },
          content: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                thai: { type: Type.STRING },
                translation: { type: Type.STRING }
              },
              required: ["thai", "translation"]
            }
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
                    imagePrompt: { type: Type.STRING }
                  },
                  required: ["thai", "translation"]
                },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                explanation: {
                  type: Type.OBJECT,
                  properties: {
                    thai: { type: Type.STRING },
                    translation: { type: Type.STRING }
                  },
                  required: ["thai", "translation"]
                }
              },
              required: ["question", "answer", "explanation"]
            }
          },
          culturalNote: { type: Type.STRING }
        },
        required: ["title", "introduction", "vocabulary", "content", "exercise"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  return JSON.parse(text) as ThaiLesson;
}

// ============================================================
// 图片生成（通过 Vercel 服务器端调用 Imagen 4）
// ============================================================

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    console.log("[IMG] Requesting image via /api/generate-image...");

    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("[IMG] API error:", response.status, errorData);
      if (response.status === 429) return "QUOTA_EXCEEDED";
      return null;
    }

    const data = await response.json();
    if (data.image) {
      console.log("[IMG] ✅ Image received!");
      return data.image;
    }
    return null;
  } catch (e: any) {
    console.error("[IMG] Error:", e?.message);
    return null;
  }
}

// ============================================================
// 语音播放（通过 Vercel 服务器端调用 Google Cloud TTS）
// ============================================================

// 缓存：同一文字不重复请求
const audioCache = new Map<string, string>();

export async function generateTTS(text: string): Promise<string | null> {
  // 先查缓存
  if (audioCache.has(text)) {
    console.log('[TTS] Cache hit:', text.substring(0, 20));
    return audioCache.get(text)!;
  }

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error('[TTS] API error:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.audio) {
      // 存入缓存
      audioCache.set(text, data.audio);
      return data.audio;
    }
    return null;
  } catch (e: any) {
    console.error('[TTS] Error:', e?.message);
    return null;
  }
}

// 播放 base64 MP3 音频
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

// 降级：浏览器原生 Web Speech API
export function speakThai(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { reject(new Error("Not supported")); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang.startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;
    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);
    window.speechSynthesis.speak(utterance);
  });
}

export async function generateAudio(text: string): Promise<string | null> {
  try {
    await speakThai(text);
    return "WEB_SPEECH_PLAYED";
  } catch (e) {
    return null;
  }
}
