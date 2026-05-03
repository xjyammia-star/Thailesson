export type Difficulty = 'Foundations' | 'Elementary' | 'Intermediate' | 'Advanced';
export type LearningFocus = 'Listening' | 'Speaking' | 'Reading' | 'Writing' | 'Comprehensive';
export type AuxiliaryLanguage = 'zh' | 'en' | 'th';

export interface UserProfile {
  userId?: string;
  age: number | string | null;
  difficulty: Difficulty;
  focus: LearningFocus;
  topic: string;
  auxiliaryLanguage: AuxiliaryLanguage;
  dailyGoal: number;
  pastVocabulary: string[];
  points: number;
  streak: number;
  lastGoalCompletionDate: string | null;
  unlockedAchievements: string[];
  lessonsCompletedToday: number;
  lastLessonDate: string | null;
}

export interface AppAchievement {
  id: string;
  province: { zh: string; en: string; th: string };
  specialty: { zh: string; en: string; th: string };
  description: { zh: string; en: string; th: string };
  imagePrompt: string; // For city landmark (locked)
  specialtyImagePrompt: string; // For specialty/attraction (unlocked)
  price: number;
  buff?: {
    type: 'points_multiplier';
    value: number;
  };
}

export interface Achievement {
  id: string;
  title: string;
  unlockedAt: string;
}

export interface ThaiLesson {
  title: string;
  introduction: string;
  vocabulary: {
    thai: string;
    phonetic: string;
    translation: string;
    example: {
      thai: string;
      translation: string;
    };
    audioText?: string;
    imagePrompt: string;
    imageUrl?: string;
  }[];
  content: {
    thai: string;
    translation: string;
  }[];
  exercise: {
    question: {
      thai: string;
      translation: string;
      imagePrompt?: string;
      imageUrl?: string;
    };
    options?: string[];
    answer: string;
    explanation: {
      thai: string;
      translation: string;
    };
  }[];
  culturalNote?: string;
}
