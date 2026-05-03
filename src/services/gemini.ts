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

function getHuggingFaceToken(): string {
  return (import.meta as any).env?.VITE_HF_TOKEN || "";
}

function getGeminiInstance(keyIndex: number = 1) {
  const apiKey = getGeminiApiKey(keyIndex);
  return new GoogleGenAI({ apiKey });
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
         * Use the user's Topic (${profile.topic}) to create creative mnemonics and background context for the characters.
         * Lesson ${lessonCount}: Focus on the next set of 4 characters or a specific phonetic concept.
         * Vocabulary should be the specific Thai characters being taught.
         * IMPORTANT: For characters, use the standard naming convention (Character + Object, e.g., 'ก' is 'Kor Kai').
         * PHONETIC ACCURACY: Must specify if it's Mid, High, or Low class consonant.
         * Sentence Length: Use only individual letters or very simple 2-syllable pairings.
       - IF Difficulty is 'Elementary': 
         * Focus on common words and basic grammar.
         * Sentence Length: Short, simple sentences (max 6 words).
       - IF Difficulty is 'Intermediate': 
         * Focus on functional communication.
         * Sentence Length: Moderate length (8-15 words) with standard conjunctions.
       - IF Difficulty is 'Advanced': 
         * Focus on complex scenarios, literary Thai, or professional discourse based on ${profile.topic}.
         * Sentence Length: Long, sophisticated sentences or even short paragraphs (at least 25 words). Use complex clauses.
    5. Content: 
       - Exactly 4 vocabulary units (words or characters).
       - UNITS MUST BE DIFFERENT FROM THESE PREVIOUS ONES: ${profile.pastVocabulary.join(', ') || 'None'}.
       - Each unit must have: thai, phonetic, translation, audioText, and a simple example (thai + translation). 
       - For characters: 
         * 'thai': The character itself (e.g., ก).
         * 'phonetic': Standard name + Class (e.g., Kor Kai [Mid class]).
         * 'translation': The meaning of the companion object (e.g., Chicken).
         * 'audioText': The TRADITIONAL FULL NAME of the character for accurate pronunciation (e.g., 'ก ไก่' for ก, 'ฝ ฝา' for ฝ). THIS IS CRITICAL for single characters.
    6. Language: Use ${profile.auxiliaryLanguage} for all explanations, translations, and instructions.
    7. Formatting: Return the response in JSON format according to the specified schema.
    8. Vocabulary Image Prompts: For each vocabulary word/character, provide a highly detailed 'imagePrompt' (scenic, high-quality, 3D render or professional photo style) reflecting the meaning or a mnemonic for the character in a Thai context. Write prompts in English only.
    9. Pronunciation: Ensure 'content' and 'exercise' Thai sentences are naturally phrased and suitable for Text-to-Speech synthesis.
    10. Conciseness: Keep the lesson content concise and focused.
  `;

  const prompt = `Generate a ${profile.difficulty} Thai lesson.
    Current Lesson Progress Index: ${lessonCount}.
    Focus on ${profile.focus} skills. 
    Topic/Context: ${profile.topic}.
    The student is ${profile.age ?? 'any'} years old. 
    Explain everything in ${profile.auxiliaryLanguage}.
    ${profile.difficulty === 'Foundations' ? 'IMPORTANT: This is a zero-knowledge beginner. Start with alphabet/pronunciation basics sequentially.' : ''}
    `;

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
// 图片生成（Hugging Face FLUX.1-schnell）
// 完全免费，不消耗 Gemini 额度
// ============================================================

export async function generateImage(prompt: string): Promise<string | null> {
  const hfToken = getHuggingFaceToken();

  if (!hfToken) {
    console.warn("[IMG] No Hugging Face token found. Set VITE_HF_TOKEN in Vercel.");
    return null;
  }

  try {
    console.log("[IMG] Calling Hugging Face FLUX.1-schnell...");

    const response = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            num_inference_steps: 4,  // schnell 只需 4 步，速度快
            width: 512,
            height: 512,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[IMG] HF API error:", response.status, errorText);

      // 模型正在加载（冷启动），返回 null 跳过图片
      if (response.status === 503) {
        console.warn("[IMG] Model is loading, skipping image for now.");
        return null;
      }
      // 额度超限
      if (response.status === 429) {
        console.warn("[IMG] HF rate limit exceeded.");
        return "QUOTA_EXCEEDED";
      }
      return null;
    }

    // 返回的是二进制图片数据
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    console.log("[IMG] ✅ Image generated successfully via Hugging Face!");
    return base64;

  } catch (e: any) {
    console.error("[IMG] ❌ Fetch error:", e?.message);
    return null;
  }
}

// Blob 转 base64 data URL
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// 语音播放（浏览器原生 Web Speech API）
// ============================================================

export function speakThai(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("Web Speech API not supported"));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH";
    utterance.rate = 0.85;
    utterance.pitch = 1.0;
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
    console.error("Web Speech API error:", e);
    return null;
  }
}
