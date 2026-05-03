import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, ThaiLesson } from "../types";

function getAIInstance() {
  // 修正：Vite 项目必须用 import.meta.env，不能用 process.env
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || "";
  return new GoogleGenAI({ apiKey });
}

export async function generateThaiLesson(profile: UserProfile, lessonCount: number): Promise<ThaiLesson> {
  const isKid = profile.age === 'primary' || profile.age === 'middle' || (typeof profile.age === 'number' && profile.age < 12);
  const ai = getAIInstance();
  
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
    8. Vocabulary Image Prompts: For each vocabulary word/character, provide a highly detailed 'imagePrompt' (scenic, high-quality, 3D render or professional photo style) reflecting the meaning or a mnemonic for the character in a Thai context.
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
    model: "gemini-2.5-flash",  // ✅ 修正：原来是假模型名 gemini-3-flash-preview
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

export async function generateImage(prompt: string): Promise<string | null> {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image", // ✅ 修正：使用正确的图片生成模型名
      contents: prompt,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      }
    });

    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData?.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e: any) {
    const status = e?.status || e?.code || 0;
    const message = e?.message || "";

    if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      console.warn("Image generation: Quota exceeded (429).");
      return "QUOTA_EXCEEDED";
    } else if (status === 403 || message.includes('403')) {
      console.warn("Image generation: Permission denied (403).");
    } else if (status === 404 || message.includes('404')) {
      console.warn("Image generation: Model not found (404).");
    } else {
      console.error("Image Generation Error", e);
    }
    return null;
  }
}

// ✅ 修正：用浏览器原生 Web Speech API 代替 Gemini TTS
// 好处：完全免费、无配额限制、泰语支持良好
export function speakThai(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error("Web Speech API not supported"));
      return;
    }

    // 停止当前正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "th-TH"; // 泰语
    utterance.rate = 0.85;    // 稍慢，适合学习
    utterance.pitch = 1.0;

    // 优先选择泰语语音，如果没有则用默认语音
    const voices = window.speechSynthesis.getVoices();
    const thaiVoice = voices.find(v => v.lang.startsWith("th"));
    if (thaiVoice) utterance.voice = thaiVoice;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => reject(e);

    window.speechSynthesis.speak(utterance);
  });
}

// 保留 generateAudio 名字作为兼容接口，内部用 Web Speech API
// 返回 null 表示不需要base64数据（Web Speech API直接播放）
export async function generateAudio(text: string): Promise<string | null> {
  try {
    await speakThai(text);
    return "WEB_SPEECH_PLAYED"; // 标记已播放
  } catch (e) {
    console.error("Web Speech API error:", e);
    return null;
  }
}
