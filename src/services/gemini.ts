import { GoogleGenAI, Type, Modality } from "@google/genai";
import { UserProfile, ThaiLesson } from "../types";

function getAIInstance() {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || "";
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
    9. Pronunciation: Ensure 'content' and 'exercise' Thai sentences are naturally phrased and suitable for high-quality Text-to-Speech synthesis.
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
    model: "gemini-3-flash-preview",
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
  const models = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview'];
  
  for (const model of models) {
    try {
      const ai = getAIInstance();
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: "1:1"
          }
        }
      });
      
      const candidates = response.candidates;
      if (candidates && candidates[0] && candidates[0].content && candidates[0].content.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
    } catch (e: any) {
      const status = e?.status || e?.code || 0;
      const message = e?.message || "";
      
      if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`Image generation (model: ${model}): Quota exceeded (429).`);
        return "QUOTA_EXCEEDED"; 
      } else if (status === 403 || message.includes('403')) {
        console.warn(`Image generation (model: ${model}): Permission denied (403).`);
      } else if (status === 404 || message.includes('404')) {
        console.warn(`Image generation (model: ${model}): Not found (404).`);
      } else {
        console.error(`Image Generation Error (${model})`, e);
      }
    }
  }
  return null;
}

export async function generateAudio(text: string): Promise<string | null> {
  try {
    const ai = getAIInstance();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ role: 'user', parts: [{ text: `Read this Thai text clearly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const candidates = response.candidates;
    return candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e: any) {
    const status = e?.status || e?.code || 0;
    const message = e?.message || "";
    if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      console.warn("TTS Quota exceeded (429).");
      return "QUOTA_EXCEEDED";
    }
    console.error("TTS Error", e);
    return null;
  }
}
