/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Settings, 
  Sparkles, 
  Volume2, 
  ChevronRight, 
  ChevronDown,
  RotateCcw, 
  CheckCircle2, 
  XCircle,
  Loader2,
  Languages,
  User,
  Gamepad2,
  ArrowLeft,
  Home
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
// ✅ 修正：删除重复的 Firebase import（原来第27-29行），只保留下面这一行
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { UserProfile, ThaiLesson, Difficulty, LearningFocus, AuxiliaryLanguage, Achievement, AppAchievement } from './types';
import { generateThaiLesson, generateImage, speakThai } from './services/gemini';

const APP_ACHIEVEMENTS: AppAchievement[] = [
  {
    id: 'bkk',
    province: { zh: '曼谷', en: 'Bangkok', th: 'กรุงเทพฯ' },
    specialty: { zh: '大皇宫与玉佛寺', en: 'The Grand Palace', th: 'พระบรมมหาราชวัง' },
    description: { 
      zh: '泰国王室的象征，融合了泰式与欧式风格。', 
      en: 'The symbolic heart of Bangkok, featuring the Emerald Buddha.', 
      th: 'ศูนย์กลางทางจิตใจของปวงฃนชาวไทย เป็นที่ประดิษฐานพระแก้วมรกต' 
    },
    imagePrompt: 'Bangkok city skyline with traditional temple rooftops and Chao Phraya river',
    specialtyImagePrompt: 'The Grand Palace in Bangkok with golden pagodas',
    price: 100,
    buff: { type: 'points_multiplier', value: 1.01 }
  },
  {
    id: 'aya',
    province: { zh: '大城', en: 'Ayutthaya', th: 'พระนครศรีอยุธยา' },
    specialty: { zh: '玛哈泰寺树中佛', en: 'Buddha Head in Tree', th: 'เศียรพระในรากไม้' },
    description: { 
      zh: '大城王朝时期的遗迹，最著名的是被古树根紧紧包裹住的石佛头部。', 
      en: 'An ancient world heritage site featuring the famous Buddha head in roots.', 
      th: 'เศีรยพระพุทธรูปในรากไม้ มรดกโลกที่ล้ำค่าในวัดมหาธาตุ' 
    },
    imagePrompt: 'Ancient brick ruins of Ayutthaya historical park',
    specialtyImagePrompt: 'Ayutthaya Buddha head in tree roots',
    price: 350,
    buff: { type: 'points_multiplier', value: 1.02 }
  },
  {
    id: 'kcn',
    province: { zh: '北碧', en: 'Kanchanaburi', th: 'กาญจนบุรี' },
    specialty: { zh: '桂河大桥', en: 'Bridge on River Kwai', th: 'สะพานข้ามแม่น้ำแคว' },
    description: { 
      zh: '著名的二战历史遗迹，见证了历史的沧桑。', 
      en: 'A historic WWII landmark, a bridge standing over the jungle river.', 
      th: 'สะพานเหล็กประวัติศาสตร์ในสงครามโลกที่กาญจนบุรี' 
    },
    imagePrompt: 'Lush tropical jungle and river scenery in Kanchanaburi',
    specialtyImagePrompt: 'The black iron bridge crossing the River Kwai',
    price: 1000,
    buff: { type: 'points_multiplier', value: 1.05 }
  },
  {
    id: 'lpb',
    province: { zh: '华富里', en: 'Lopburi', th: 'ลพบุรี' },
    specialty: { zh: '三峰塔与猴子', en: 'Phra Prang Sam Yod', th: 'พระปรางค์สามยอด' },
    description: { 
      zh: '古老的高棉风格遗迹，以成群结队的猴子闻名。', 
      en: 'Ancient Khmer-style towers famous for the hundreds of monkeys.', 
      th: 'ปราสาทขอมโบราณและฝูงลิงที่เป็นเอกลักษณ์ของลพบุรี' 
    },
    imagePrompt: 'Ancient stone Khmer towers under a bright Thai sky',
    specialtyImagePrompt: 'Monkeys at Phra Prang Sam Yod',
    price: 3000,
    buff: { type: 'points_multiplier', value: 1.10 }
  },
  {
    id: 'pkt',
    province: { zh: '普吉', en: 'Phuket', th: 'ภูเก็ต' },
    specialty: { zh: '中葡风情老城', en: 'Phuket Old Town', th: 'ย่านเมืองเก่าภูเก็ต' },
    description: { 
      zh: '保留了大量色彩斑斓的"中葡式建筑"。', 
      en: 'A historic district featuring vibrant Sino-Portuguese shophouses.', 
      th: 'ย่านตึกเก่าศิลปะชิโนโปรตุกีสในตัวเมืองภูเก็ต' 
    },
    imagePrompt: 'Tropical beach with limestone karsts in Phuket',
    specialtyImagePrompt: 'Colorful shophouses in Phuket Old Town',
    price: 10000,
    buff: { type: 'points_multiplier', value: 1.20 }
  },
  {
    id: 'samui',
    province: { zh: '苏梅岛', en: 'Koh Samui', th: 'เกาะสมุย' },
    specialty: { zh: '巨型大佛', en: 'Big Buddha Temple', th: 'วัดพระใหญ่' },
    description: { 
      zh: '坐落于小岛上的12米高金色大佛。', 
      en: 'A 12-meter tall golden Buddha statue on a small island.', 
      th: 'พระพุทธรูปทองคำขนาดใหญ่ที่เป็นสัญลักษณ์ของเกาะสมุย' 
    },
    imagePrompt: 'Samui palm trees and white sand beaches',
    specialtyImagePrompt: 'Golden Buddha statue in Koh Samui',
    price: 30000,
    buff: { type: 'points_multiplier', value: 1.35 }
  },
  {
    id: 'cnx',
    province: { zh: '清迈', en: 'Chiang Mai', th: 'เชียงใหม่' },
    specialty: { zh: '素帖寺 (双龙寺)', en: 'Wat Phra That Doi Suthep', th: 'วัดพระธาตุดอยสุเทพ' },
    description: { 
      zh: '清迈最神圣的寺庙，坐落于素帖山上。', 
      en: 'Chiang Mai\'s most sacred temple located on a mountain.', 
      th: 'วัดศักดิ์สิทธิ์คู่บ้านคู่เมืองเชียงใหม่ ตั้งอยู่บนดอยสุเทพ' 
    },
    imagePrompt: 'Chiang Mai old city walls with misty mountains',
    specialtyImagePrompt: 'Golden pagoda of Wat Phra That Doi Suthep',
    price: 80000,
    buff: { type: 'points_multiplier', value: 1.60 }
  },
  {
    id: 'skh',
    province: { zh: '素可泰', en: 'Sukhothai', th: 'สุโขทัย' },
    specialty: { zh: '西昌寺大佛', en: 'Phra Achana (Wat Si Chum)', th: 'วัดศรีชุม' },
    description: { 
      zh: '素可泰王朝的艺术精髓，坐佛庄严神圣。', 
      en: 'The heart of Thailand\'s first capital, featuring a massive seated Buddha.', 
      th: 'จุดมหากุศลแห่งสุโขทัย พระอัจนะในวัดศรีชุม' 
    },
    imagePrompt: 'Sukhothai historical park ruins',
    specialtyImagePrompt: 'Massive stone sitting Buddha in Sukhothai',
    price: 200000,
    buff: { type: 'points_multiplier', value: 2.00 }
  },
  {
    id: 'kbi',
    province: { zh: '甲米', en: 'Krabi', th: 'กระบี่' },
    specialty: { zh: '莱利海滩攀岩', en: 'Railay Rock Climbing', th: 'ไร่เลย์' },
    description: { 
      zh: '甲米以壮丽的喀斯特地貌闻名，莱利海滩是攀岩天堂。', 
      en: 'Famous for limestone karsts, Railay is a global rock-climbing destination.', 
      th: 'หน้าผาหินปูนและหาดทรายขาวในจังหวัดกระบี่' 
    },
    imagePrompt: 'Dramatic limestone cliffs in Krabi',
    specialtyImagePrompt: 'A climber on a limestone cliff in Railay',
    price: 500000,
    buff: { type: 'points_multiplier', value: 3.00 }
  },
  {
    id: 'loe',
    province: { zh: '黎府', en: 'Loei', th: 'เลย' },
    specialty: { zh: '鬼脸节面具', en: 'Phi Ta Khon Mask', th: 'ผีตาโขน' },
    description: { 
      zh: '手工彩绘的面具有着夸张的鼻子和艳丽的图案。', 
      en: 'Vibrant handmade masks from the Phi Ta Khon festival.', 
      th: 'งานเทศกาลผีตาโขนที่เป็นเอกลักษณ์ของจังหวัดเลย' 
    },
    imagePrompt: 'Mist rolling over the mountains of Loei',
    specialtyImagePrompt: 'Colorful handmade Thai ghost mask',
    price: 1200000,
    buff: { type: 'points_multiplier', value: 5.00 }
  }
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [step, setStep] = useState<'setup' | 'learning' | 'loading' | 'museum'>('setup');
  const [profile, setProfile] = useState<UserProfile>({
    age: 'primary',
    difficulty: 'Foundations',
    focus: 'Comprehensive',
    topic: 'Daily Conversation',
    auxiliaryLanguage: 'zh',
    dailyGoal: 1,
    pastVocabulary: [],
    points: 0,
    streak: 0,
    lastGoalCompletionDate: null,
    unlockedAchievements: [],
    lessonsCompletedToday: 0,
    lastLessonDate: null
  });
  const [lesson, setLesson] = useState<ThaiLesson | null>(null);
  const [lessonCount, setLessonCount] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // ✅ 修正：不再需要 audioData (base64缓存)，Web Speech API 直接播放
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showExerciseTranslations, setShowExerciseTranslations] = useState<Record<number, boolean>>({});
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [museumLang, setMuseumLang] = useState<AuxiliaryLanguage>('zh');
  const [hasApiKey, setHasApiKey] = useState(true);

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // Auth and Firebase Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const today = new Date().toLocaleDateString();
        
        if (userDoc.exists()) {
          const cloudData = userDoc.data() as UserProfile;
          if (cloudData.lastLessonDate !== today) {
            cloudData.lessonsCompletedToday = 0;
            cloudData.lastLessonDate = today;
            await setDoc(doc(db, 'users', firebaseUser.uid), cloudData);
          }
          setProfile(cloudData);
        } else {
          const initialProfile: UserProfile = { 
            ...profileRef.current, 
            userId: firebaseUser.uid,
            lastLessonDate: today,
            lessonsCompletedToday: 0
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), initialProfile);
          setProfile(initialProfile);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const saveProfile = async (updated: UserProfile) => {
    setProfile(updated);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), updated);
      } catch (e) {
        console.error("Firebase save error", e);
      }
    } else {
      localStorage.setItem('sawasdee_profile', JSON.stringify(updated));
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("Login failed", e);
    }
  };

  const handleLogout = () => auth.signOut();

  useEffect(() => {
    const checkApiKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        try {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(selected);
        } catch (e) {
          console.error("Error checking API key", e);
        }
      }
    };
    checkApiKey();
  }, []);

  const handleStart = async (isNext = false) => {
    setStep('loading');
    setError(null);
    setLoadingText(currentT.loadingCrafting);
    
    try {
      const nextCount = isNext ? lessonCount + 1 : 1;
      const generatedLesson = await generateThaiLesson(profile, nextCount);
      
      setLoadingText(currentT.loadingImages);
      
      const limitedVocab = generatedLesson.vocabulary.slice(0, 4);
      let quotaExceeded = false;

      const imagesToGenerate: { prompt: string, callback: (url: string) => void }[] = [];
      
      limitedVocab.forEach(v => {
        imagesToGenerate.push({ prompt: v.imagePrompt, callback: (url) => { v.imageUrl = url; } });
      });

      generatedLesson.exercise.forEach(ex => {
        if (ex.question.imagePrompt) {
          imagesToGenerate.push({ prompt: ex.question.imagePrompt, callback: (url) => { ex.question.imageUrl = url; } });
        }
      });

      for (const item of imagesToGenerate) {
        if (quotaExceeded) break;
        try {
          const imageUrl = await generateImage(item.prompt);
          if (imageUrl === "QUOTA_EXCEEDED") {
            quotaExceeded = true;
          } else if (imageUrl) {
            item.callback(imageUrl);
          }
          await new Promise(resolve => setTimeout(resolve, 1200));
        } catch (e) {
          console.warn("Failed to generate image for prompt:", item.prompt, e);
        }
      }

      if (quotaExceeded) {
        setError(currentT.quotaError);
      }

      const finalLesson = { ...generatedLesson, vocabulary: limitedVocab };
      setLesson(finalLesson);
      setLessonCount(nextCount);
      setStep('learning');
      setShowResults(false);
      setShowExerciseTranslations({});
      setAnswers({});

      const newWords = finalLesson.vocabulary.map(v => v.thai);
      setProfile(prev => ({
        ...prev,
        pastVocabulary: [...new Set([...prev.pastVocabulary, ...newWords])]
      }));
    } catch (err) {
      setError('Failed to generate lesson. Please try again.');
      setStep('setup');
    }
  };

  const calculateScore = () => {
    if (!lesson) return 0;
    let correct = 0;
    lesson.exercise.forEach((ex, idx) => {
      if (answers[idx]?.toLowerCase() === ex.answer.toLowerCase()) {
        correct++;
      }
    });
    return (correct / lesson.exercise.length) * 100;
  };

  const unlockedCount = profile.unlockedAchievements?.length || 0;
  const pointsMultiplier = APP_ACHIEVEMENTS
    .filter(a => profile.unlockedAchievements?.includes(a.id))
    .reduce((acc, curr) => acc + (curr.buff?.value ? curr.buff.value - 1 : 0), 1)
    + (unlockedCount >= 10 ? 10.0 : (unlockedCount >= 9 ? 3.0 : (unlockedCount >= 5 ? 1.0 : 0)));

  const calculatePointsReward = (goal: number, isStreak: boolean) => {
    let base = 0;
    if (goal === 1) base = 10;
    else if (goal === 3) base = 30;
    else if (goal === 5) base = 50;
    else if (goal === 10) base = 150;
    if (goal === 10 && isStreak) base += 50;
    return Math.round(base * pointsMultiplier);
  };

  // ✅ 修正：playAudio 改用 Web Speech API，删除原来复杂的 base64 + AudioContext 逻辑
  const playAudio = async (text: string, speakText?: string) => {
    setAudioError(null);
    const textToSpeak = speakText || text;
    
    if (!window.speechSynthesis) {
      setAudioError(currentT.audioError);
      return;
    }

    try {
      setLoadingAudio(text);
      
      // 等待语音列表加载（某些浏览器需要）
      await new Promise<void>((resolve) => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          resolve();
        } else {
          window.speechSynthesis.onvoiceschanged = () => resolve();
          setTimeout(resolve, 500); // 最多等500ms
        }
      });

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'th-TH';
      utterance.rate = 0.85;
      
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find(v => v.lang.startsWith('th'));
      if (thaiVoice) utterance.voice = thaiVoice;

      utterance.onend = () => setLoadingAudio(null);
      utterance.onerror = () => {
        setLoadingAudio(null);
        setAudioError(currentT.playbackError);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      setLoadingAudio(null);
      setAudioError(currentT.playbackError);
    }
  };

  const handleFinishLesson = async () => {
    const score = calculateScore();
    const completed = profile.lessonsCompletedToday + 1;
    const today = new Date().toLocaleDateString();
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
    const baseReward = Math.round((score / 10) * pointsMultiplier);
    
    let updatedProfile = {
      ...profile,
      lessonsCompletedToday: completed,
      points: profile.points + baseReward
    };

    if (completed > 0 && completed % profile.dailyGoal === 0) {
      let newStreak = profile.streak;
      if (profile.lastGoalCompletionDate !== today) {
        if (profile.lastGoalCompletionDate === yesterday) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
      }
      const goalBonus = calculatePointsReward(profile.dailyGoal, newStreak > 1 && profile.dailyGoal === 10);
      updatedProfile = {
        ...updatedProfile,
        points: updatedProfile.points + goalBonus,
        streak: newStreak,
        lastGoalCompletionDate: today
      };
    }
    
    await saveProfile(updatedProfile);
    setShowResults(true);
  };

  const isKid = profile.age === 'primary' || profile.age === 'middle' || (typeof profile.age === 'number' && profile.age < 12);

  const t = {
    zh: {
      setupTitle: '定制你的泰语课程',
      setupDesc: '告诉 AI 你的需求，我们将为你生成最适合的学习内容。',
      age: '学习阶段',
      ageCategories: { primary: '小学', middle: '初中', high: '高中', adult: '成年' },
      auxLang: '辅助语言',
      difficulty: '学习等级',
      focus: '学习重点',
      topicLabel: '感兴趣的主题 (如：哈利波特)',
      topicPlaceholder: '输入你想学习的内容背景...',
      enableImages: '开启图像生成 (需选择 API Key)',
      generateBtn: '开始生成课程',
      loadingCrafting: '正在为您编排泰语课程...',
      loadingImages: '正在为您生成精美插图...',
      loadingWriting: '正在为你编写专属教材...',
      loadingMagic: '魔法正在发生，请稍等！',
      loadingAI: 'AI 正在根据你的偏好整合泰语知识点。',
      dailyGoal: '今日目标',
      reset: '重新设置',
      museum: '成就馆',
      museumTitle: '成就博物馆',
      locked: '未解锁',
      levels: { Foundations: '入门 (发音/字母)', Elementary: '初级 (基础词汇)', Intermediate: '中级 (日常对话)', Advanced: '高级 (地道表达)' },
      focuses: { Listening: '听力', Speaking: '口语', Reading: '阅读', Writing: '写作', Comprehensive: '综合' },
      focusDescriptions: {
        Listening: '核心逻辑：磨炼辨音与语调。内容表现：强化音频内容、听力理解专练、泰语声调识别。',
        Speaking: '核心逻辑：模拟实战对话。内容表现：场景化角色扮演、口语发音细节指导、泰文转写/语音提示。',
        Reading: '核心逻辑：文字拆解与长句。内容表现：泰文字母笔画拆解、长句结构分析、阅读短文。',
        Writing: '核心逻辑：构词逻辑与翻译。内容表现：泰语单词听写训练、笔画顺序指导、汉泰互译深度练习。',
        Comprehensive: '核心逻辑：平衡各维发展。内容表现：听、说、读、写均衡覆盖，适合稳健进阶。'
      },
      levelDescriptions: {
        Foundations: '适合零基础。从泰语辅音、元音和五大声调开始，打好发音基础。',
        Elementary: '核心在于常用词汇。学习简单的日常用语、数字和基础语法结构。',
        Intermediate: '专注于实际对话。能够处理点餐、问路等真实生活场景中的交流。',
        Advanced: '挑战地道表达。深入研究文学、新闻、俚语以及复杂的句式逻辑。'
      },
      goalRewardLabel: (reward: number) => `完成此目标可获得 ✧ ${reward} 积分基础奖励`,
      nextLesson: '下一课',
      keyVocab: '核心词汇',
      reading: '阅读训练',
      interactive: '互动练习',
      placeholderAnswer: '输入你的答案...',
      submit: '提交答案',
      correctAnswer: '正确答案',
      culturalNote: '文化小贴士',
      progress: '学习进度',
      milestone: (completed: number) => `你已经完成了 ${completed} 个课时。距离下一个里程碑还有 ${10 - (completed % 10)} 课！`,
      quotaError: '图像生成配额已用完。本课将不带图片显示。您可以明天再试，或更换 API Key。',
      audioError: '语音服务暂时不可用，请稍后再试。',
      playbackError: '播放失败，请重试。',
      museumDesc: '这里展示了你通过辛勤学习解锁的泰式珍宝。',
      balance: '可用余额',
      discoveryTitle: '泰国文化探索之旅',
      discoveryProgress: (unlocked: number, target: number, multi: string) => `您已经解锁了 ${unlocked} / ${target} 件泰珍宝。由于您的努力，每节课的收益已提升了 x${multi} 倍！`,
      rewardRoyal: '👑 皇家殿堂奖赏 (+10.0x)',
      rewardExpert: '🌟 泰国通奖赏 (+3.0x)',
      rewardExploring: '泰境探索中...',
      rewardNovice: '初见成效奖励 (+1.0x)',
      regions: { exploring: '初探泰国', southern: '南部风情', northern: '北部遗迹', ultimate: '终极艺术' },
      pointsLabel: '积分',
      unlockWith: '解锁需要',
      login: '登录保存进度',
      logout: '退出',
      streakLabel: '连胜',
      home: '首页'
    },
    en: {
      setupTitle: 'Customize Your Thai Lesson',
      setupDesc: 'Tell AI your needs, and we will generate the most suitable learning content for you.',
      age: 'Education Level',
      ageCategories: { primary: 'Primary School', middle: 'Middle School', high: 'High School', adult: 'Adult' },
      auxLang: 'Auxiliary Language',
      difficulty: 'Difficulty Level',
      focus: 'Learning Focus',
      topicLabel: 'Interested Topic (e.g. Harry Potter)',
      topicPlaceholder: 'Enter a topic you want to learn about...',
      enableImages: 'Enable Images (Requires API Key)',
      generateBtn: 'Generate Lesson',
      loadingCrafting: 'Crafting your Thai lesson...',
      loadingImages: 'Generating beautiful illustrations...',
      loadingWriting: 'Creating your custom lesson...',
      loadingMagic: 'Magic is happening, please wait!',
      loadingAI: 'AI is integrating Thai knowledge points based on your preferences.',
      dailyGoal: 'Daily Goal',
      reset: 'Reset',
      museum: 'Museum',
      museumTitle: 'Museum of Achievements',
      locked: 'Locked',
      levels: { Foundations: 'Foundations (Alphabet)', Elementary: 'Elementary (Words)', Intermediate: 'Intermediate (Conversations)', Advanced: 'Advanced (Fluent)' },
      focuses: { Listening: 'Listening', Speaking: 'Speaking', Reading: 'Reading', Writing: 'Writing', Comprehensive: 'Comprehensive' },
      focusDescriptions: {
        Listening: 'Core Logic: Sharpening phoneme recognition and intonation.',
        Speaking: 'Core Logic: Simulating real-world dialogue.',
        Reading: 'Core Logic: Text decomposition and sentence structure.',
        Writing: 'Core Logic: Word construction and translation.',
        Comprehensive: 'Core Logic: Balanced development across all dimensions.'
      },
      levelDescriptions: {
        Foundations: 'Perfect for beginners. Start with Thai consonants, vowels, and the five tones.',
        Elementary: 'Focuses on common vocabulary. Learn simple everyday phrases and basic grammar.',
        Intermediate: 'Concentrates on practical conversations. Handle real-life scenarios.',
        Advanced: 'Master native expressions. Dive deep into literature, news, and slang.'
      },
      goalRewardLabel: (reward: number) => `Reward for this goal: ✧ ${reward} base points`,
      nextLesson: 'Next Lesson',
      keyVocab: 'Key Vocabulary',
      reading: 'Reading',
      interactive: 'Interactive Exercises',
      placeholderAnswer: 'Type your answer...',
      submit: 'Submit Answers',
      correctAnswer: 'Correct Answer',
      culturalNote: 'Cultural Note',
      progress: 'Your Progress',
      milestone: (completed: number) => `You have completed ${completed} lessons. ${10 - (completed % 10)} more to the next milestone!`,
      quotaError: 'Image generation quota exceeded. This lesson will show without images.',
      audioError: 'Voice service temporarily unavailable. Please try again later.',
      playbackError: 'Playback failed, please try again.',
      museumDesc: 'Treasures of Thailand unlocked through your dedication.',
      balance: 'Available Balance',
      discoveryTitle: 'Thailand Discovery Journey',
      discoveryProgress: (unlocked: number, target: number, multi: string) => `You've unlocked ${unlocked} / ${target} Thai treasures. Earnings boosted by x${multi}!`,
      rewardRoyal: '👑 Royal Hall Bonus (+10.0x)',
      rewardExpert: '🌟 Thai Expert Bonus (+3.0x)',
      rewardExploring: 'Exploring Thailand...',
      rewardNovice: 'Early Success Bonus (+1.0x)',
      regions: { exploring: 'The Beginning', southern: 'Southern Vibes', northern: 'Northern Legacy', ultimate: 'Ultimate Art' },
      pointsLabel: 'Points',
      unlockWith: 'Unlock for',
      login: 'Sign in to save',
      logout: 'Sign out',
      streakLabel: 'Streak',
      home: 'Home'
    },
    th: {
      setupTitle: 'ปรับแต่งบทเรียนภาษาไทยของคุณ',
      setupDesc: 'บอกความต้องการของคุณกับ AI แล้วเราจะสร้างเนื้อหาการเรียนรู้ที่เหมาะสมที่สุดให้กับคุณ',
      age: 'ระดับการศึกษา',
      ageCategories: { primary: 'ประถมศึกษา', middle: 'มัธยมศึกษาตอนต้น', high: 'มัธยมศึกษาตอนปลาย', adult: 'ผู้ใหญ่' },
      auxLang: 'ภาษาเสริม',
      difficulty: 'ระดับความยาก',
      focus: 'เน้นการเรียนรู้',
      topicLabel: 'หัวข้อที่สนใจ (เช่น แฮร์รี่ พอตเตอร์)',
      topicPlaceholder: 'ป้อนหัวข้อที่คุณต้องการเรียนรู้...',
      enableImages: 'เปิดใช้งานรูปภาพ (ต้องมี API Key)',
      generateBtn: 'สร้างบทเรียน',
      loadingCrafting: 'กำลังสร้างบทเรียนภาษาไทยของคุณ...',
      loadingImages: 'กำลังสร้างภาพประกอบที่สวยงาม...',
      loadingWriting: 'กำลังสร้างสื่อการเรียนรู้ส่วนตัวของคุณ...',
      loadingMagic: 'ความมหัศจรรย์กำลังเกิดขึ้น โปรดรอสักครู่!',
      loadingAI: 'AI กำลังรวมจุดความรู้ภาษาไทยตามความต้องการของคุณ',
      dailyGoal: 'เป้าหมายรายวัน',
      reset: 'ตั้งค่าใหม่',
      museum: 'พิพิธภัณฑ์',
      museumTitle: 'พิพิธภัณฑ์ความสำเร็จ',
      locked: 'ล็อกอยู่',
      levels: { Foundations: 'ระดับพื้้นฐาน (อักษร)', Elementary: 'ระดับเริ่มต้น (คำศัพท์)', Intermediate: 'ระดับกลาง (บทสนทนา)', Advanced: 'ระดับสูง (คล่องแคล่ว)' },
      focuses: { Listening: 'การฟัง', Speaking: 'การพูด', Reading: 'การอ่าน', Writing: 'การเขียน', Comprehensive: 'ครอบคลุม' },
      focusDescriptions: {
        Listening: 'ตรรกะหลัก: ฝึกฝนการรับรู้หน่วยเสียงและเสียงสูงต่ำ',
        Speaking: 'ตรรกะหลัก: จำลองการสนทนาในโลกแห่งความเป็นจริง',
        Reading: 'ตรรกะหลัก: การแยกองค์ประกอบข้อความและโครงสร้างประโยค',
        Writing: 'ตรรกะหลัก: การสร้างคำและการแปล',
        Comprehensive: 'ตรรกะหลัก: การพัฒนาที่สมดุลในทุกมิติ'
      },
      levelDescriptions: {
        Foundations: 'เหมาะสำหรับผู้เริ่มต้น เริ่มต้นด้วยพยัญชนะ สระ และวรรณยุกต์ทั้ง 5 เสียง',
        Elementary: 'เน้นที่คำศัพท์ทั่วไป เรียนรู้วลีที่ใช้ในชีวิตประจำวัน',
        Intermediate: 'เน้นการสนทนาที่ใช้ได้จริง จัดการกับสถานการณ์ในชีวิตจริง',
        Advanced: 'เชี่ยวชาญการแสดงออกอย่างเจ้าของภาษา เจาะลึกวรรณกรรม'
      },
      goalRewardLabel: (reward: number) => `รางวัลสำหรับเป้าหมายนี้: ✧ ${reward} คะแนนพื้นฐาน`,
      nextLesson: 'บทเรียนถัดไป',
      keyVocab: 'คำศัพท์หลัก',
      reading: 'การอ่าน',
      interactive: 'แบบฝึกหัดโต้ตอบ',
      placeholderAnswer: 'พิมพ์คำตอบของคุณ...',
      submit: 'ส่งคำตอบ',
      correctAnswer: 'คำตอบที่ถูกต้อง',
      culturalNote: 'บันทึกทางวัฒนธรรม',
      progress: 'ความก้าวหน้าของคุณ',
      milestone: (completed: number) => `คุณเรียนจบไปแล้ว ${completed} บทเรียน อีก ${10 - (completed % 10)} บทเรียนจะถึงจุดหมายถัดไป!`,
      quotaError: 'โควตาการสร้างรูปภาพหมดแล้ว บทเรียนนี้จะแสดงโดยไม่มีรูปภาพ',
      audioError: 'บริการเสียงไม่พร้อมใช้งานชั่วคราว โปรดลองอีกครั้งในภายหลัง',
      playbackError: 'การเล่นล้มเหลว โปรดลองอีกครั้ง',
      museumDesc: 'ขุมทรัพย์แห่งประเทศไทยที่ปลดล็อกด้วยความทุ่มเทของคุณ',
      balance: 'ยอดคงเหลือ',
      discoveryTitle: 'เส้นทางการค้นพบวัฒนธรรมไทย',
      discoveryProgress: (unlocked: number, target: number, multi: string) => `คุณได้ปลดล็อกขุมทรัพย์ไทยแล้ว ${unlocked} / ${target} ชิ้น รายได้ต่อบทเรียนเพิ่มขึ้น x${multi} เท่า!`,
      rewardRoyal: '👑 รางวัลระดับพระราชวัง (+10.0x)',
      rewardExpert: '🌟 รางวัลผู้เชี่ยวชาญไทย (+3.0x)',
      rewardExploring: 'กำลังสำรวจประเทศไทย...',
      rewardNovice: 'รางวัลความสำเร็จเบื้องต้น (+1.0x)',
      regions: { exploring: 'เริ่มต้นสำรวจ', southern: 'เสน่ห์แดนใต้', northern: 'มรดกทางเหนือ', ultimate: 'ที่สุดแห่งศิลปะ' },
      pointsLabel: 'คะแนน',
      unlockWith: 'ปลดล็อกด้วย',
      login: 'เข้าสู่ระบบเพื่อบันทึก',
      logout: 'ออกจากระบบ',
      streakLabel: 'ต่อเนื่อง',
      home: 'หน้าแรก'
    }
  };

  const currentT = t[profile.auxiliaryLanguage === 'th' ? 'th' : profile.auxiliaryLanguage === 'en' ? 'en' : 'zh'];

  const MuseumView = () => {
    const [museumLang, setMuseumLang] = useState<'zh' | 'en' | 'th'>((localStorage.getItem('language') || 'zh') as 'zh' | 'en' | 'th');
    const museumT = t[museumLang];
    const [buyingId, setBuyingId] = useState<string | null>(null);

    const handleBuy = async (ach: AppAchievement) => {
      if (profile.points >= ach.price && !profile.unlockedAchievements.includes(ach.id)) {
        setBuyingId(ach.id);
        const updated = {
          ...profile,
          points: profile.points - ach.price,
          unlockedAchievements: [...profile.unlockedAchievements, ach.id]
        };
        await saveProfile(updated);
        setBuyingId(null);
      }
    };

    const unlockedCount = profile.unlockedAchievements.length;
    const totalCount = APP_ACHIEVEMENTS.length;
    let displayTarget = 5;
    if (unlockedCount >= 9) displayTarget = 10;
    else if (unlockedCount >= 5) displayTarget = 9;
    const milestoneProgressPercent = (unlockedCount / displayTarget) * 100;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setStep('setup')} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl shadow-lg transition-all text-slate-300 border border-white/5">
                <ArrowLeft size={24} />
              </button>
              <div>
                <h2 className="text-4xl font-display font-black text-white tracking-tight uppercase">{museumT.museumTitle}</h2>
                <p className="text-slate-400 font-medium">{museumT.museumDesc}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="bg-thai-blue px-6 py-4 rounded-[2rem] shadow-xl border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-thai-gold/10 rounded-2xl flex items-center justify-center text-thai-gold shadow-inner">
                <Sparkles size={28} fill="currentColor" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] leading-none mb-2">{museumT.balance}</p>
                <p className="text-2xl font-black text-white leading-none tracking-tight">✧ {profile.points.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(['zh', 'en', 'th'] as const).map(lang => (
                <button key={lang} onClick={() => setMuseumLang(lang)}
                  className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${museumLang === lang ? 'bg-thai-gold text-thai-navy scale-105' : 'bg-white/5 text-slate-400 border border-white/5 hover:border-white/20'}`}>
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-thai-blue p-8 rounded-[2.5rem] shadow-xl shadow-black/20 border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 text-white"><Gamepad2 size={120} /></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * Math.min(milestoneProgressPercent, 100)) / 100} strokeLinecap="round" className="text-thai-gold transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-xl font-black text-white">{unlockedCount}/{displayTarget}</span>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="text-xl font-black text-white mb-1">{museumT.discoveryTitle}</h3>
              <p className="text-slate-400 font-medium leading-relaxed">
                {museumT.discoveryProgress(unlockedCount, displayTarget, pointsMultiplier.toFixed(2))}
              </p>
              {unlockedCount >= 5 && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${unlockedCount >= 9 ? 'bg-thai-gold/20 border-thai-gold/30 text-thai-gold' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${unlockedCount >= 9 ? 'bg-thai-gold animate-pulse' : 'bg-slate-700'}`} />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {unlockedCount >= 10 ? museumT.rewardRoyal : unlockedCount >= 9 ? museumT.rewardExpert : museumT.rewardExploring}
                    </span>
                  </div>
                  {unlockedCount >= 5 && unlockedCount < 9 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-thai-blue/50 rounded-xl border border-thai-gold/20 text-thai-gold/80">
                      <span className="w-2 h-2 rounded-full bg-thai-gold/60" />
                      <span className="text-[10px] font-black uppercase tracking-wider font-display">{museumT.rewardNovice}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {APP_ACHIEVEMENTS.map((ach, idx) => {
            const unlocked = profile.unlockedAchievements.includes(ach.id);
            const canAfford = profile.points >= ach.price;
            const getTierColor = () => {
              if (idx < 3) return 'border-blue-500/20 bg-blue-500/10 text-blue-400';
              if (idx < 6) return 'border-teal-500/20 bg-teal-500/10 text-teal-400';
              if (idx < 9) return 'border-amber-500/20 bg-amber-500/10 text-amber-400';
              return 'border-rose-500/20 bg-rose-500/10 text-rose-400';
            };
            const getRegionName = () => {
              if (idx < 3) return museumT.regions.exploring;
              if (idx < 6) return museumT.regions.southern;
              if (idx < 9) return museumT.regions.northern;
              return museumT.regions.ultimate;
            };
            return (
              <motion.div key={ach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className={`group relative overflow-hidden rounded-[2.25rem] border-2 transition-all p-6 flex flex-col gap-5 ${unlocked ? 'bg-thai-blue border-white/5 shadow-xl shadow-black/20 hover:shadow-2xl hover:shadow-black/30 hover:-translate-y-1' : 'bg-white/5 border-white/5 grayscale-[0.8] opacity-80'}`}>
                <div className="flex justify-between items-start">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getTierColor()}`}>{getRegionName()}</span>
                  {!unlocked && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 backdrop-blur rounded-full text-[10px] font-black text-slate-400 shadow-sm border border-white/5">
                      ✧ {ach.price.toLocaleString()}
                    </div>
                  )}
                </div>
                <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-white/5 shadow-inner">
                  {unlocked ? (
                    <div className="relative w-full h-full">
                      <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${ach.id}-specialty&backgroundColor=0b1120`} alt={ach.specialty[museumLang]} className="w-full h-full object-cover p-8" />
                      <div className="absolute inset-0 bg-gradient-to-t from-thai-blue via-transparent to-transparent opacity-60" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/10 group-hover:text-white/20 transition-all">
                      <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${ach.id}-province&backgroundColor=0b1120`} alt={ach.province[museumLang]} className="w-full h-full object-cover p-12 opacity-30 blur-[2px]" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <Sparkles size={48} className="opacity-10 mb-3 animate-pulse" />
                        <p className="text-[10px] font-display font-black uppercase tracking-[0.3em]">
                          {museumLang === 'zh' ? '尚未探索' : museumLang === 'th' ? 'ซ่อนอยู่' : 'Landmark Hidden'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <h3 className={`text-xl font-display font-black tracking-tight ${unlocked ? 'text-white' : 'text-slate-500'}`}>
                    {unlocked ? ach.specialty[museumLang] : ach.province[museumLang]}
                  </h3>
                  <div className="min-h-[4.5rem]">
                    <p className={`text-sm leading-relaxed font-body ${unlocked ? 'text-slate-300' : 'text-slate-600 italic font-medium'}`}>
                      {unlocked ? ach.description[museumLang] : (museumLang === 'zh' ? `解锁以探索 ${ach.province[museumLang]} 府的神秘古迹、地域特产和文化加成。` : museumLang === 'th' ? `ปลดล็อกเพื่อสำรวจมรดกลึกลับและของดีประจำจังหวัด${ach.province[museumLang]}` : `Unlock to discover the hidden heritage and cultural specialties of ${ach.province[museumLang]}.`)}
                    </p>
                  </div>
                  {unlocked ? (
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-400">
                        <div className="w-6 h-6 rounded-lg bg-green-400/10 flex items-center justify-center"><CheckCircle2 size={14} /></div>
                        <span className="text-[10px] font-display font-black uppercase tracking-widest">{museumLang === 'zh' ? '已解锁' : museumLang === 'th' ? 'ปลดล็อกแล้ว' : 'Unlocked'}</span>
                      </div>
                      <div className="text-[10px] font-display font-black text-thai-gold bg-thai-gold/10 px-3 py-1 rounded-lg border border-thai-gold/20">BUFF: x{ach.buff?.value.toFixed(2)}</div>
                    </div>
                  ) : (
                    <button disabled={!canAfford || buyingId === ach.id} onClick={() => handleBuy(ach)}
                      className={`mt-auto w-full py-4 rounded-2xl font-display font-black text-sm transition-all flex items-center justify-center gap-2 ${canAfford ? 'bg-thai-gold text-thai-navy hover:bg-white shadow-xl shadow-black/20 active:scale-95' : 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'}`}>
                      {buyingId === ach.id ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} fill={canAfford ? "currentColor" : "none"} />{museumT.unlockWith} ✧ {ach.price.toLocaleString()}</>}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-thai-navy text-slate-100 font-body">
      <header className="sticky top-0 z-50 bg-thai-navy/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setStep('setup')}>
            <div className="w-10 h-10 bg-thai-gold rounded-xl flex items-center justify-center shadow-lg shadow-thai-gold/20 group-hover:scale-110 transition-transform">
              <Sparkles className="text-thai-navy" size={20} />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-display font-black text-white tracking-tight">Sawasdee<span className="text-thai-gold italic">!</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold -mt-1">Thai Language Tutor</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-4 px-3 md:px-4 py-2 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-1.5 md:gap-2 text-thai-gold font-bold">
                  <span className="text-[10px] uppercase tracking-tighter opacity-60 font-black text-amber-500">🔥</span>
                  <span className="text-sm md:text-md">{profile.streak || 0}</span>
                </div>
                <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-1.5 md:gap-2 text-slate-300 font-bold">
                  <span className="text-[10px] uppercase tracking-tighter opacity-60 font-black">✧</span>
                  <span className="text-sm md:text-md">{profile.points || 0}</span>
                </div>
              </div>
            )}
            <div className="flex bg-white/5 p-1 rounded-[1.25rem] border border-white/10">
              <button onClick={() => setStep('setup')} className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${step === 'setup' || step === 'learning' ? 'bg-thai-gold text-thai-navy shadow-sm' : 'text-slate-400 hover:text-white'}`} title={currentT.home}>
                <Home size={20} />
                <span className={`text-xs font-bold ${step !== 'museum' ? 'block' : 'hidden md:block'}`}>{currentT.home}</span>
              </button>
              <button onClick={() => setStep('museum')} className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${step === 'museum' ? 'bg-thai-gold text-thai-navy shadow-sm' : 'text-slate-400 hover:text-white'}`} title={currentT.museum}>
                <Gamepad2 size={20} />
                <span className={`text-xs font-bold ${step === 'museum' ? 'block' : 'hidden md:block'}`}>{currentT.museum}</span>
              </button>
            </div>
            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-white/10">
                {user.photoURL && <img src={user.photoURL} alt="Profile" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-thai-gold shadow-md" />}
                <button onClick={handleLogout} className="p-2 md:p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 transition-all border border-white/5" title={currentT.logout}>
                  <RotateCcw size={18} />
                </button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-thai-gold text-thai-navy rounded-2xl font-bold hover:bg-white transition-all shadow-md shadow-thai-gold/10">
                <User size={18} />
                <span className="hidden sm:inline">{currentT.login}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {step === 'museum' && <MuseumView />}
          {step === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-4xl font-display font-black mb-4 text-white uppercase tracking-tight">{currentT.setupTitle}</h2>
                <p className="text-slate-400 font-medium">{currentT.setupDesc}</p>
              </div>
              <div className="bg-thai-blue rounded-[3rem] p-10 shadow-2xl shadow-black/30 border border-white/5 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><User size={16} className="text-thai-gold" />{currentT.age}</label>
                    <div className="relative">
                      <select value={profile.age || ''} onChange={(e) => setProfile({ ...profile, age: e.target.value || null })} className="w-full px-5 py-4 rounded-2xl border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        <option value="" className="bg-thai-navy">未选择 / Undefined</option>
                        {Object.entries(currentT.ageCategories).map(([key, label]) => (<option key={key} value={key} className="bg-thai-navy">{label}</option>))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDown size={16} className="text-slate-500" /></div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Languages size={16} className="text-thai-gold" />{currentT.auxLang}</label>
                    <select value={profile.auxiliaryLanguage} onChange={(e) => setProfile({ ...profile, auxiliaryLanguage: e.target.value as AuxiliaryLanguage })} className="w-full px-5 py-4 rounded-2xl border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all appearance-none bg-white/5 font-bold text-white cursor-pointer">
                      <option value="zh" className="bg-thai-navy">中文 (zh)</option>
                      <option value="en" className="bg-thai-navy">English (en)</option>
                      <option value="th" className="bg-thai-navy">ภาษาไทย (th)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Settings size={16} className="text-thai-gold" />{currentT.difficulty}</label>
                    <div className="relative">
                      <select value={profile.difficulty} onChange={(e) => setProfile({ ...profile, difficulty: e.target.value as Difficulty })} className="w-full px-5 py-4 rounded-2xl border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {(['Foundations', 'Elementary', 'Intermediate', 'Advanced'] as Difficulty[]).map((level) => (<option key={level} value={level} className="bg-thai-navy">{currentT.levels[level]}</option>))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDown size={16} className="text-slate-500" /></div>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={profile.difficulty} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[13px] text-slate-300 leading-relaxed font-bold italic">{currentT.levelDescriptions[profile.difficulty as keyof typeof currentT.levelDescriptions]}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Sparkles size={16} className="text-thai-gold" />{currentT.focus}</label>
                    <div className="relative">
                      <select value={profile.focus} onChange={(e) => setProfile({ ...profile, focus: e.target.value as LearningFocus })} className="w-full px-5 py-4 rounded-2xl border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {(['Listening', 'Speaking', 'Reading', 'Writing', 'Comprehensive'] as LearningFocus[]).map((f) => (<option key={f} value={f} className="bg-thai-navy">{currentT.focuses[f]}</option>))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDown size={16} className="text-slate-500" /></div>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={profile.focus} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-2 p-4 bg-white/5 rounded-2xl border border-white/5">
                        <p className="text-[13px] text-slate-300 leading-relaxed font-bold italic">{currentT.focusDescriptions[profile.focus as keyof typeof currentT.focusDescriptions]}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><CheckCircle2 size={16} className="text-thai-gold" />{currentT.dailyGoal}</label>
                    <div className="relative">
                      <select value={profile.dailyGoal} onChange={(e) => setProfile({ ...profile, dailyGoal: parseInt(e.target.value) })} className="w-full px-5 py-4 rounded-2xl border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {[1, 3, 5, 10].map((goal) => (<option key={goal} value={goal} className="bg-thai-navy">{goal} {museumLang === 'zh' ? '课时' : (museumLang === 'th' ? 'บทเรียน' : 'Lessons')}</option>))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronDown size={16} className="text-slate-500" /></div>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={profile.dailyGoal} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="mt-2 p-3 bg-thai-gold/5 rounded-2xl border border-thai-gold/10 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-thai-gold/10 flex items-center justify-center text-thai-gold shadow-sm"><Sparkles size={14} /></div>
                        <p className="text-[12px] font-black text-thai-gold/80">{currentT.goalRewardLabel(calculatePointsReward(profile.dailyGoal, false))}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Gamepad2 size={16} className="text-thai-gold" />{currentT.topicLabel}</label>
                    <input type="text" value={profile.topic} onChange={(e) => setProfile({ ...profile, topic: e.target.value })} placeholder={currentT.topicPlaceholder} className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none transition-all font-bold text-white placeholder:text-slate-600" />
                  </div>
                </div>
                <div className="space-y-5">
                  {!hasApiKey && (
                    <button onClick={async () => { if ((window as any).aistudio) { await (window as any).aistudio.openSelectKey(); const selected = await (window as any).aistudio.hasSelectedApiKey(); setHasApiKey(selected); } }} className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-5 rounded-[2rem] shadow-lg transition-all flex items-center justify-center gap-2 border border-white/5">
                      <Settings size={20} className="text-thai-gold" />{currentT.enableImages}
                    </button>
                  )}
                  <button onClick={() => handleStart()} className="w-full bg-thai-gold hover:scale-[1.02] active:scale-95 text-thai-navy font-black py-5 rounded-[2rem] shadow-xl shadow-thai-gold/10 transition-all flex items-center justify-center gap-2 group">
                    {currentT.generateBtn}<ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
                {error && <p className="text-red-500 text-center text-sm font-medium">{error}</p>}
              </div>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <Loader2 size={64} className="text-thai-gold animate-spin" />
                <Sparkles size={24} className="text-thai-gold absolute -top-2 -right-2 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-display font-black text-white uppercase tracking-tight">{loadingText || currentT.loadingWriting}</h3>
                <p className="text-slate-400 font-medium mt-2">{isKid ? currentT.loadingMagic : currentT.loadingAI}</p>
              </div>
            </motion.div>
          )}

          {step === 'learning' && lesson && (
            <motion.div key="learning" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className={`p-10 rounded-[2.5rem] text-white shadow-2xl ${isKid ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-thai-navy' : 'bg-thai-blue border border-white/5'}`}>
                <div className="flex items-center justify-between mb-6">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${isKid ? 'bg-thai-navy/10 border-thai-navy/10' : 'bg-white/5 border-white/10'}`}>
                    {currentT.levels[profile.difficulty]} • {currentT.focuses[profile.focus]}
                  </span>
                  <button onClick={() => handleStart(true)} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-lg active:scale-95 ${isKid ? 'bg-thai-navy text-white hover:bg-black' : 'bg-thai-gold text-thai-navy hover:bg-white'}`}>
                    {currentT.nextLesson}
                  </button>
                </div>
                <h2 className="text-5xl font-display font-black mb-6 uppercase tracking-tight">{lesson.title}</h2>
                <p className={`text-lg leading-relaxed max-w-3xl font-medium ${isKid ? 'text-thai-navy/80' : 'text-slate-300'}`}>{lesson.introduction}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-display font-black flex items-center gap-2 text-white uppercase tracking-tight"><Sparkles size={24} className="text-thai-gold" />{currentT.keyVocab}</h3>
                      <AnimatePresence>
                        {audioError && (
                          <motion.span initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-xs text-red-400 font-bold bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20">{audioError}</motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {lesson.vocabulary.map((vocab, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-thai-gold/30 transition-all group shadow-inner">
                          <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl font-black text-thai-gold">{vocab.thai}</span>
                            <button onClick={() => playAudio(vocab.thai, vocab.audioText)} disabled={loadingAudio === vocab.thai}
                              className={`p-3 rounded-full transition-all ${loadingAudio === vocab.thai ? 'bg-thai-gold/20 text-thai-gold animate-pulse' : 'bg-white/5 text-slate-400 hover:text-thai-gold hover:bg-white/10'}`}>
                              {loadingAudio === vocab.thai ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
                            </button>
                          </div>
                          {vocab.imageUrl ? (
                            <img src={vocab.imageUrl} alt={vocab.thai} className="w-full h-40 object-cover rounded-xl mb-3 shadow-2xl border border-white/5" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-40 bg-thai-navy/50 border-2 border-dashed border-white/10 rounded-xl mb-3 flex items-center justify-center"><Sparkles className="text-white/10" size={32} /></div>
                          )}
                          <p className="text-xs font-mono text-slate-500 mb-1 tracking-wider uppercase">{vocab.phonetic}</p>
                          <p className="text-lg font-black text-white mb-2">{vocab.translation}</p>
                          <div className="text-xs space-y-2 pt-2 border-t border-white/5">
                            <p className="text-slate-400 italic leading-relaxed">"{vocab.example.thai}"</p>
                            <p className="text-slate-500">({vocab.example.translation})</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-2 text-white uppercase tracking-tight"><BookOpen size={24} className="text-thai-gold" />{currentT.reading}</h3>
                    <div className="space-y-8">
                      {lesson.content.map((item, idx) => (
                        <div key={idx} className="pb-8 border-b border-white/5 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-xl font-black text-thai-gold mb-3">{item.thai}</p>
                            <button onClick={() => playAudio(item.thai)} className="p-3 rounded-2xl bg-white/5 text-slate-400 hover:text-thai-gold hover:bg-white/10 transition-all flex-shrink-0" disabled={loadingAudio === item.thai}>
                              {loadingAudio === item.thai ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                            </button>
                          </div>
                          <p className="text-lg text-slate-400 italic leading-relaxed font-medium">{item.translation}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-2 text-white uppercase tracking-tight"><Gamepad2 size={24} className="text-thai-gold" />{currentT.interactive}</h3>
                    <div className="space-y-10">
                      {lesson.exercise.map((ex, idx) => (
                        <div key={idx} className="space-y-6">
                          <div className="flex items-start justify-between gap-4 border-l-4 border-thai-gold pl-6">
                            <div className="space-y-4 flex-1">
                              <div>
                                <div className="flex items-start justify-between gap-4">
                                  <p className="text-lg font-black text-white leading-relaxed">{idx + 1}. {ex.question.thai}</p>
                                  <button onClick={() => playAudio(ex.question.thai)} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-thai-gold transition-all flex-shrink-0" disabled={loadingAudio === ex.question.thai}>
                                    {loadingAudio === ex.question.thai ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                                  </button>
                                </div>
                                {showExerciseTranslations[idx] && (
                                  <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-slate-400 italic mt-2 font-medium">{ex.question.translation}</motion.p>
                                )}
                              </div>
                              {ex.question.imageUrl ? (
                                <img src={ex.question.imageUrl} alt="Exercise visual" className="w-full max-w-sm h-48 object-cover rounded-3xl shadow-2xl border border-white/5" referrerPolicy="no-referrer" />
                              ) : ex.question.imagePrompt ? (
                                <div className="w-full max-w-sm h-48 bg-thai-navy/50 border-2 border-dashed border-white/10 rounded-3xl flex items-center justify-center"><Sparkles className="text-white/10" size={32} /></div>
                              ) : null}
                            </div>
                            <button onClick={() => setShowExerciseTranslations(prev => ({ ...prev, [idx]: !prev[idx] }))} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 transition-all flex-shrink-0 border border-white/5">
                              <Languages size={18} />
                            </button>
                          </div>
                          {ex.options ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {ex.options.map((opt, optIdx) => (
                                <button key={optIdx} onClick={() => setAnswers({ ...answers, [idx]: opt })}
                                  className={`p-5 rounded-2xl text-left text-sm font-black transition-all border-2 shadow-sm ${answers[idx] === opt ? 'bg-thai-gold text-thai-navy border-thai-gold shadow-thai-gold/20' : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20'}`}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input type="text" value={answers[idx] || ''} onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })} placeholder={currentT.placeholderAnswer} className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-thai-gold/20 focus:border-thai-gold outline-none text-white font-bold" />
                          )}
                          {showResults && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                              className={`p-6 rounded-[2rem] text-sm font-bold border-2 ${answers[idx]?.toLowerCase() === ex.answer.toLowerCase() ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                              <div className="flex items-center gap-3 mb-3 text-lg font-black uppercase tracking-tight">
                                {answers[idx]?.toLowerCase() === ex.answer.toLowerCase() ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                                {currentT.correctAnswer}: {ex.answer}
                              </div>
                              <div className="space-y-2 opacity-90 pl-9 border-l border-white/10">
                                <p className="text-base text-white">{ex.explanation.thai}</p>
                                <p className="text-sm italic text-slate-400">({ex.explanation.translation})</p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                    {!showResults ? (
                      <button onClick={handleFinishLesson} className="mt-12 w-full py-5 bg-thai-gold text-thai-navy font-black rounded-3xl hover:bg-white transition-all shadow-xl shadow-thai-gold/10 active:scale-95">{currentT.submit}</button>
                    ) : (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-12 p-10 bg-thai-blue rounded-[3rem] border-2 border-thai-gold shadow-2xl shadow-thai-gold/20 text-center space-y-6">
                        <div className="w-20 h-20 bg-thai-gold/10 text-thai-gold rounded-[2rem] flex items-center justify-center mx-auto shadow-inner"><CheckCircle2 size={40} /></div>
                        <div>
                          <h3 className="text-3xl font-display font-black text-white uppercase tracking-tight">
                            {calculateScore() === 100 ? (museumLang === 'zh' ? '完美表现！' : 'Perfect Score!') : (museumLang === 'zh' ? '练习完成' : 'Lesson Complete')}
                          </h3>
                          <p className="text-xl text-slate-400 font-bold mt-2">
                            {museumLang === 'zh' ? '您获得了' : 'You earned'} <span className="text-thai-gold font-black">✧ {Math.round((calculateScore() / 10) * pointsMultiplier)}</span> {currentT.pointsLabel}
                          </p>
                          {profile.lessonsCompletedToday % profile.dailyGoal === 0 && (
                            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 p-4 bg-thai-gold text-thai-navy rounded-2xl shadow-lg text-sm font-black flex items-center justify-center gap-2 uppercase tracking-widest">
                              <Sparkles size={18} />
                              {museumLang === 'zh' ? `目标达成奖励：+${calculatePointsReward(profile.dailyGoal, profile.streak > 1 && profile.dailyGoal === 10)} 积分！` : `Goal Bonus: +${calculatePointsReward(profile.dailyGoal, profile.streak > 1 && profile.dailyGoal === 10)} Points!`}
                            </motion.div>
                          )}
                        </div>
                        <button onClick={() => setStep('setup')} className="w-full py-5 bg-thai-gold text-thai-navy font-black rounded-2xl hover:bg-white transition-all shadow-xl active:scale-95">
                          {museumLang === 'zh' ? '返回首页' : 'Return Home'}
                        </button>
                      </motion.div>
                    )}
                  </section>
                </div>

                <div className="space-y-8">
                  {lesson.culturalNote && (
                    <section className="bg-thai-gold/10 rounded-[2.5rem] p-8 border border-thai-gold/20 shadow-xl">
                      <h4 className="text-thai-gold font-display font-black mb-4 flex items-center gap-2 uppercase tracking-widest"><Sparkles size={20} />{currentT.culturalNote}</h4>
                      <p className="text-slate-200 text-sm leading-relaxed italic font-medium">{lesson.culturalNote}</p>
                    </section>
                  )}
                  <section className="bg-thai-blue rounded-[2.5rem] p-8 shadow-xl border border-white/5">
                    <h4 className="font-display font-black mb-6 text-white uppercase tracking-widest text-sm">{currentT.progress}</h4>
                    <div className="space-y-6">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <span>{currentT.focuses[profile.focus]}</span>
                        <span className="text-thai-gold">{Math.round(((profile.lessonsCompletedToday % profile.dailyGoal) / profile.dailyGoal) * 100)}%</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 shadow-inner">
                        <div className="h-full bg-thai-gold rounded-full transition-all duration-1000 shadow-lg shadow-thai-gold/20" style={{ width: `${Math.round(((profile.lessonsCompletedToday % profile.dailyGoal) / profile.dailyGoal) * 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">{currentT.milestone(profile.lessonsCompletedToday)}</p>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-20 border-t border-white/5 mt-20 bg-black/20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
            © 2026 Sawasdee Learn • Powered by Gemini AI
          </p>
        </div>
      </footer>
    </div>
  );
}
