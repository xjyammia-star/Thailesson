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
  Home,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { UserProfile, ThaiLesson, Difficulty, LearningFocus, AuxiliaryLanguage, AppAchievement } from './types';
import { generateThaiLesson, getAvailableKeys } from './services/gemini';

const APP_ACHIEVEMENTS: AppAchievement[] = [
  { id: 'bkk', province: { zh: '曼谷', en: 'Bangkok', th: 'กรุงเทพฯ' }, specialty: { zh: '大皇宫与玉佛寺', en: 'The Grand Palace', th: 'พระบรมมหาราชวัง' }, description: { zh: '泰国王室的象征，融合了泰式与欧式风格。', en: 'The symbolic heart of Bangkok, featuring the Emerald Buddha.', th: 'ศูนย์กลางทางจิตใจของปวงฃนชาวไทย' }, imagePrompt: '', specialtyImagePrompt: '', price: 100, buff: { type: 'points_multiplier', value: 1.01 } },
  { id: 'aya', province: { zh: '大城', en: 'Ayutthaya', th: 'พระนครศรีอยุธยา' }, specialty: { zh: '玛哈泰寺树中佛', en: 'Buddha Head in Tree', th: 'เศียรพระในรากไม้' }, description: { zh: '大城王朝时期的遗迹，最著名的是被古树根紧紧包裹住的石佛头部。', en: 'An ancient world heritage site featuring the famous Buddha head in roots.', th: 'มรดกโลกที่ล้ำค่าในวัดมหาธาตุ' }, imagePrompt: '', specialtyImagePrompt: '', price: 350, buff: { type: 'points_multiplier', value: 1.02 } },
  { id: 'kcn', province: { zh: '北碧', en: 'Kanchanaburi', th: 'กาญจนบุรี' }, specialty: { zh: '桂河大桥', en: 'Bridge on River Kwai', th: 'สะพานข้ามแม่น้ำแคว' }, description: { zh: '著名的二战历史遗迹，见证了历史的沧桑。', en: 'A historic WWII landmark over the jungle river.', th: 'สะพานเหล็กประวัติศาสตร์ในสงครามโลก' }, imagePrompt: '', specialtyImagePrompt: '', price: 1000, buff: { type: 'points_multiplier', value: 1.05 } },
  { id: 'lpb', province: { zh: '华富里', en: 'Lopburi', th: 'ลพบุรี' }, specialty: { zh: '三峰塔与猴子', en: 'Phra Prang Sam Yod', th: 'พระปรางค์สามยอด' }, description: { zh: '古老的高棉风格遗迹，以成群结队的猴子闻名。', en: 'Ancient Khmer-style towers famous for hundreds of monkeys.', th: 'ปราสาทขอมโบราณและฝูงลิงที่เป็นเอกลักษณ์' }, imagePrompt: '', specialtyImagePrompt: '', price: 3000, buff: { type: 'points_multiplier', value: 1.10 } },
  { id: 'pkt', province: { zh: '普吉', en: 'Phuket', th: 'ภูเก็ต' }, specialty: { zh: '中葡风情老城', en: 'Phuket Old Town', th: 'ย่านเมืองเก่าภูเก็ต' }, description: { zh: '保留了大量色彩斑斓的"中葡式建筑"。', en: 'A historic district featuring vibrant Sino-Portuguese shophouses.', th: 'ย่านตึกเก่าศิลปะชิโนโปรตุกีส' }, imagePrompt: '', specialtyImagePrompt: '', price: 10000, buff: { type: 'points_multiplier', value: 1.20 } },
  { id: 'samui', province: { zh: '苏梅岛', en: 'Koh Samui', th: 'เกาะสมุย' }, specialty: { zh: '巨型大佛', en: 'Big Buddha Temple', th: 'วัดพระใหญ่' }, description: { zh: '坐落于小岛上的12米高金色大佛。', en: 'A 12-meter tall golden Buddha statue on a small island.', th: 'พระพุทธรูปทองคำขนาดใหญ่' }, imagePrompt: '', specialtyImagePrompt: '', price: 30000, buff: { type: 'points_multiplier', value: 1.35 } },
  { id: 'cnx', province: { zh: '清迈', en: 'Chiang Mai', th: 'เชียงใหม่' }, specialty: { zh: '素帖寺', en: 'Wat Phra That Doi Suthep', th: 'วัดพระธาตุดอยสุเทพ' }, description: { zh: '清迈最神圣的寺庙，坐落于素帖山上。', en: "Chiang Mai's most sacred temple on a mountain.", th: 'วัดศักดิ์สิทธิ์บนดอยสุเทพ' }, imagePrompt: '', specialtyImagePrompt: '', price: 80000, buff: { type: 'points_multiplier', value: 1.60 } },
  { id: 'skh', province: { zh: '素可泰', en: 'Sukhothai', th: 'สุโขทัย' }, specialty: { zh: '西昌寺大佛', en: 'Phra Achana', th: 'วัดศรีชุม' }, description: { zh: '素可泰王朝的艺术精髓，坐佛庄严神圣。', en: "Thailand's first capital with a massive seated Buddha.", th: 'พระอัจนะในวัดศรีชุม' }, imagePrompt: '', specialtyImagePrompt: '', price: 200000, buff: { type: 'points_multiplier', value: 2.00 } },
  { id: 'kbi', province: { zh: '甲米', en: 'Krabi', th: 'กระบี่' }, specialty: { zh: '莱利海滩', en: 'Railay Beach', th: 'ไร่เลย์' }, description: { zh: '甲米以壮丽的喀斯特地貌闻名，莱利海滩是攀岩天堂。', en: 'Famous limestone karsts and a global rock-climbing destination.', th: 'หน้าผาหินปูนและหาดทรายขาว' }, imagePrompt: '', specialtyImagePrompt: '', price: 500000, buff: { type: 'points_multiplier', value: 3.00 } },
  { id: 'loe', province: { zh: '黎府', en: 'Loei', th: 'เลย' }, specialty: { zh: '鬼脸节面具', en: 'Phi Ta Khon Mask', th: 'ผีตาโขน' }, description: { zh: '手工彩绘的面具有着夸张的鼻子和艳丽的图案。', en: 'Vibrant handmade masks from the Phi Ta Khon festival.', th: 'งานเทศกาลผีตาโขน' }, imagePrompt: '', specialtyImagePrompt: '', price: 1200000, buff: { type: 'points_multiplier', value: 5.00 } }
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [step, setStep] = useState<'setup' | 'learning' | 'loading' | 'museum'>('setup');
  const [profile, setProfile] = useState<UserProfile>({
    age: 'primary', difficulty: 'Foundations', focus: 'Comprehensive', topic: 'Daily Conversation',
    auxiliaryLanguage: 'zh', dailyGoal: 1, pastVocabulary: [], points: 0, streak: 0,
    lastGoalCompletionDate: null, unlockedAchievements: [], lessonsCompletedToday: 0, lastLessonDate: null
  });
  const [lesson, setLesson] = useState<ThaiLesson | null>(null);
  const [lessonCount, setLessonCount] = useState(0);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [showExerciseTranslations, setShowExerciseTranslations] = useState<Record<number, boolean>>({});

  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number>(() => {
    const saved = localStorage.getItem('sawasdee_key_index');
    return saved ? parseInt(saved) : 1;
  });

  const availableKeys = getAvailableKeys();

  const handleKeySelect = (index: number) => {
    setSelectedKeyIndex(index);
    localStorage.setItem('sawasdee_key_index', String(index));
  };

  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

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
          const initialProfile: UserProfile = { ...profileRef.current, userId: firebaseUser.uid, lastLessonDate: today, lessonsCompletedToday: 0 };
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
      try { await setDoc(doc(db, 'users', user.uid), updated); }
      catch (e) { console.error("Firebase save error", e); }
    } else {
      localStorage.setItem('sawasdee_profile', JSON.stringify(updated));
    }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { console.error("Login failed", e); }
  };

  const handleLogout = () => auth.signOut();

  const handleStart = async (isNext = false) => {
    setStep('loading');
    setError(null);
    setLoadingText(currentT.loadingCrafting);
    try {
      const nextCount = isNext ? lessonCount + 1 : 1;
      const generatedLesson = await generateThaiLesson(profile, nextCount, selectedKeyIndex);
      const finalLesson = { ...generatedLesson, vocabulary: generatedLesson.vocabulary.slice(0, 4) };
      setLesson(finalLesson);
      setLessonCount(nextCount);
      setStep('learning');
      setShowResults(false);
      setShowExerciseTranslations({});
      setAnswers({});
      const newWords = finalLesson.vocabulary.map(v => v.thai);
      setProfile(prev => ({ ...prev, pastVocabulary: [...new Set([...prev.pastVocabulary, ...newWords])] }));
    } catch (err) {
      setError('Failed to generate lesson. Please try again.');
      setStep('setup');
    }
  };

  const calculateScore = () => {
    if (!lesson) return 0;
    let correct = 0;
    lesson.exercise.forEach((ex, idx) => { if (answers[idx]?.toLowerCase() === ex.answer.toLowerCase()) correct++; });
    return (correct / lesson.exercise.length) * 100;
  };

  const unlockedCount = profile.unlockedAchievements?.length || 0;
  const pointsMultiplier = APP_ACHIEVEMENTS
    .filter(a => profile.unlockedAchievements?.includes(a.id))
    .reduce((acc, curr) => acc + (curr.buff?.value ? curr.buff.value - 1 : 0), 1)
    + (unlockedCount >= 10 ? 10.0 : (unlockedCount >= 9 ? 3.0 : (unlockedCount >= 5 ? 1.0 : 0)));

  const calculatePointsReward = (goal: number, isStreak: boolean) => {
    let base = goal === 1 ? 10 : goal === 3 ? 30 : goal === 5 ? 50 : 150;
    if (goal === 10 && isStreak) base += 50;
    return Math.round(base * pointsMultiplier);
  };

  // ✅ 修复语音播放
  const playAudio = async (text: string, speakText?: string) => {
    setAudioError(null);
    const textToSpeak = speakText || text;
    try {
      setLoadingAudio(text);
      const synth = window.speechSynthesis;
      if (!synth) { setAudioError(currentT.audioError); setLoadingAudio(null); return; }
      synth.cancel();
      const getVoices = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
        const v = synth.getVoices();
        if (v.length > 0) return resolve(v);
        synth.onvoiceschanged = () => resolve(synth.getVoices());
        setTimeout(() => resolve(synth.getVoices()), 1000);
      });
      const voices = await getVoices();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'th-TH';
      utterance.rate = 0.8;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      const thaiVoice = voices.find(v => v.lang.startsWith('th'));
      if (thaiVoice) utterance.voice = thaiVoice;
      utterance.onend = () => setLoadingAudio(null);
      utterance.onerror = () => { setLoadingAudio(null); setAudioError(currentT.playbackError); };
      synth.speak(utterance);
      if (/iP(hone|ad|od)/.test(navigator.userAgent)) setTimeout(() => { if (synth.paused) synth.resume(); }, 100);
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
    let updated = { ...profile, lessonsCompletedToday: completed, points: profile.points + baseReward };
    if (completed > 0 && completed % profile.dailyGoal === 0) {
      let newStreak = profile.streak;
      if (profile.lastGoalCompletionDate !== today)
        newStreak = profile.lastGoalCompletionDate === yesterday ? newStreak + 1 : 1;
      const goalBonus = calculatePointsReward(profile.dailyGoal, newStreak > 1 && profile.dailyGoal === 10);
      updated = { ...updated, points: updated.points + goalBonus, streak: newStreak, lastGoalCompletionDate: today };
    }
    await saveProfile(updated);
    setShowResults(true);
  };

  const isKid = profile.age === 'primary' || profile.age === 'middle' || (typeof profile.age === 'number' && profile.age < 12);

  const t = {
    zh: {
      setupTitle: '定制你的泰语课程', setupDesc: '告诉 AI 你的需求，我们将为你生成最适合的学习内容。',
      age: '学习阶段', ageCategories: { primary: '小学', middle: '初中', high: '高中', adult: '成年' },
      auxLang: '辅助语言', difficulty: '学习等级', focus: '学习重点',
      topicLabel: '感兴趣的主题', topicPlaceholder: '输入你想学习的内容背景...',
      generateBtn: '开始生成课程', loadingCrafting: '正在为您编排泰语课程...',
      loadingWriting: '正在为你编写专属教材...', loadingMagic: '魔法正在发生，请稍等！',
      loadingAI: 'AI 正在根据你的偏好整合泰语知识点。', dailyGoal: '今日目标',
      museum: '成就馆', museumTitle: '成就博物馆', apiKeyLabel: 'API Key 选择',
      levels: { Foundations: '入门 (发音/字母)', Elementary: '初级 (基础词汇)', Intermediate: '中级 (日常对话)', Advanced: '高级 (地道表达)' },
      focuses: { Listening: '听力', Speaking: '口语', Reading: '阅读', Writing: '写作', Comprehensive: '综合' },
      focusDescriptions: { Listening: '核心：磨炼辨音与语调。', Speaking: '核心：模拟实战对话。', Reading: '核心：文字拆解与长句。', Writing: '核心：构词逻辑与翻译。', Comprehensive: '核心：平衡各维发展。' },
      levelDescriptions: { Foundations: '适合零基础。从泰语辅音、元音和五大声调开始。', Elementary: '核心在于常用词汇和基础语法。', Intermediate: '专注于实际对话场景。', Advanced: '挑战地道表达，研究复杂句式。' },
      goalRewardLabel: (r: number) => `完成此目标可获得 ✧ ${r} 积分`, nextLesson: '下一课',
      keyVocab: '核心词汇', reading: '阅读训练', interactive: '互动练习',
      placeholderAnswer: '输入你的答案...', submit: '提交答案', correctAnswer: '正确答案',
      culturalNote: '文化小贴士', progress: '学习进度',
      milestone: (n: number) => `已完成 ${n} 课时，距下一里程碑还有 ${10 - (n % 10)} 课！`,
      audioError: '语音不可用，请先安装 Windows 泰语语音包。', playbackError: '播放失败，请重试。',
      museumDesc: '通过辛勤学习解锁的泰式珍宝。', balance: '可用余额',
      discoveryTitle: '泰国文化探索之旅',
      discoveryProgress: (u: number, t: number, m: string) => `已解锁 ${u}/${t} 件珍宝，课程收益提升 x${m} 倍！`,
      rewardRoyal: '👑 皇家奖赏 (+10.0x)', rewardExpert: '🌟 泰国通奖赏 (+3.0x)',
      rewardExploring: '探索中...', rewardNovice: '初级奖励 (+1.0x)',
      regions: { exploring: '初探泰国', southern: '南部风情', northern: '北部遗迹', ultimate: '终极艺术' },
      pointsLabel: '积分', unlockWith: '解锁需要', login: '登录保存进度', logout: '退出', home: '首页'
    },
    en: {
      setupTitle: 'Customize Your Thai Lesson', setupDesc: 'Tell AI your needs and we will generate the best content for you.',
      age: 'Education Level', ageCategories: { primary: 'Primary', middle: 'Middle', high: 'High School', adult: 'Adult' },
      auxLang: 'Auxiliary Language', difficulty: 'Difficulty', focus: 'Focus',
      topicLabel: 'Topic of Interest', topicPlaceholder: 'Enter a topic...',
      generateBtn: 'Generate Lesson', loadingCrafting: 'Crafting your lesson...',
      loadingWriting: 'Writing your lesson...', loadingMagic: 'Magic happening!',
      loadingAI: 'AI integrating Thai knowledge for you.', dailyGoal: 'Daily Goal',
      museum: 'Museum', museumTitle: 'Museum of Achievements', apiKeyLabel: 'API Key',
      levels: { Foundations: 'Foundations', Elementary: 'Elementary', Intermediate: 'Intermediate', Advanced: 'Advanced' },
      focuses: { Listening: 'Listening', Speaking: 'Speaking', Reading: 'Reading', Writing: 'Writing', Comprehensive: 'Comprehensive' },
      focusDescriptions: { Listening: 'Sharpen phoneme recognition.', Speaking: 'Simulate real dialogue.', Reading: 'Text decomposition.', Writing: 'Word construction.', Comprehensive: 'Balanced development.' },
      levelDescriptions: { Foundations: 'For beginners. Start with consonants, vowels, and tones.', Elementary: 'Common vocabulary and basic grammar.', Intermediate: 'Practical conversations.', Advanced: 'Master native expressions.' },
      goalRewardLabel: (r: number) => `Reward: ✧ ${r} points`, nextLesson: 'Next Lesson',
      keyVocab: 'Key Vocabulary', reading: 'Reading', interactive: 'Exercises',
      placeholderAnswer: 'Type your answer...', submit: 'Submit', correctAnswer: 'Correct Answer',
      culturalNote: 'Cultural Note', progress: 'Progress',
      milestone: (n: number) => `${n} lessons done. ${10 - (n % 10)} more to milestone!`,
      audioError: 'Voice unavailable. Please install Thai voice pack.', playbackError: 'Playback failed.',
      museumDesc: 'Treasures unlocked through dedication.', balance: 'Balance',
      discoveryTitle: 'Thailand Discovery',
      discoveryProgress: (u: number, t: number, m: string) => `Unlocked ${u}/${t}. Earnings x${m}!`,
      rewardRoyal: '👑 Royal Bonus (+10.0x)', rewardExpert: '🌟 Expert Bonus (+3.0x)',
      rewardExploring: 'Exploring...', rewardNovice: 'Novice Bonus (+1.0x)',
      regions: { exploring: 'Beginning', southern: 'South', northern: 'North', ultimate: 'Ultimate' },
      pointsLabel: 'Points', unlockWith: 'Unlock for', login: 'Sign in', logout: 'Sign out', home: 'Home'
    },
    th: {
      setupTitle: 'ปรับแต่งบทเรียนของคุณ', setupDesc: 'บอก AI ความต้องการของคุณ',
      age: 'ระดับการศึกษา', ageCategories: { primary: 'ประถม', middle: 'มัธยมต้น', high: 'มัธยมปลาย', adult: 'ผู้ใหญ่' },
      auxLang: 'ภาษาเสริม', difficulty: 'ระดับความยาก', focus: 'เน้นการเรียนรู้',
      topicLabel: 'หัวข้อที่สนใจ', topicPlaceholder: 'ป้อนหัวข้อ...',
      generateBtn: 'สร้างบทเรียน', loadingCrafting: 'กำลังสร้างบทเรียน...',
      loadingWriting: 'กำลังเขียนบทเรียน...', loadingMagic: 'กำลังเกิดขึ้น!',
      loadingAI: 'AI กำลังรวมความรู้', dailyGoal: 'เป้าหมายรายวัน',
      museum: 'พิพิธภัณฑ์', museumTitle: 'พิพิธภัณฑ์', apiKeyLabel: 'API Key',
      levels: { Foundations: 'พื้นฐาน', Elementary: 'เริ่มต้น', Intermediate: 'กลาง', Advanced: 'สูง' },
      focuses: { Listening: 'ฟัง', Speaking: 'พูด', Reading: 'อ่าน', Writing: 'เขียน', Comprehensive: 'ครอบคลุม' },
      focusDescriptions: { Listening: 'ฝึกการฟัง', Speaking: 'ฝึกการพูด', Reading: 'ฝึกการอ่าน', Writing: 'ฝึกการเขียน', Comprehensive: 'ครอบคลุมทุกด้าน' },
      levelDescriptions: { Foundations: 'สำหรับผู้เริ่มต้น', Elementary: 'คำศัพท์พื้นฐาน', Intermediate: 'บทสนทนาจริง', Advanced: 'ระดับเจ้าของภาษา' },
      goalRewardLabel: (r: number) => `รางวัล: ✧ ${r} คะแนน`, nextLesson: 'บทถัดไป',
      keyVocab: 'คำศัพท์', reading: 'อ่าน', interactive: 'แบบฝึกหัด',
      placeholderAnswer: 'พิมพ์คำตอบ...', submit: 'ส่ง', correctAnswer: 'คำตอบที่ถูก',
      culturalNote: 'บันทึกวัฒนธรรม', progress: 'ความก้าวหน้า',
      milestone: (n: number) => `เรียนจบ ${n} บทแล้ว!`,
      audioError: 'เสียงไม่พร้อม', playbackError: 'เล่นไม่ได้',
      museumDesc: 'ขุมทรัพย์ที่ปลดล็อกแล้ว', balance: 'ยอดคงเหลือ',
      discoveryTitle: 'สำรวจไทย',
      discoveryProgress: (u: number, t: number, m: string) => `ปลดล็อก ${u}/${t} x${m}!`,
      rewardRoyal: '👑 รางวัลพระราชวัง', rewardExpert: '🌟 ผู้เชี่ยวชาญ',
      rewardExploring: 'กำลังสำรวจ...', rewardNovice: 'รางวัลเริ่มต้น',
      regions: { exploring: 'เริ่มต้น', southern: 'ใต้', northern: 'เหนือ', ultimate: 'สุดยอด' },
      pointsLabel: 'คะแนน', unlockWith: 'ปลดล็อก', login: 'เข้าสู่ระบบ', logout: 'ออก', home: 'หน้าแรก'
    }
  };

  const currentT = t[profile.auxiliaryLanguage === 'th' ? 'th' : profile.auxiliaryLanguage === 'en' ? 'en' : 'zh'];

  const MuseumView = () => {
    const [mLang, setMLang] = useState<'zh' | 'en' | 'th'>('zh');
    const mT = t[mLang];
    const [buyingId, setBuyingId] = useState<string | null>(null);

    const handleBuy = async (ach: AppAchievement) => {
      if (profile.points >= ach.price && !profile.unlockedAchievements.includes(ach.id)) {
        setBuyingId(ach.id);
        await saveProfile({ ...profile, points: profile.points - ach.price, unlockedAchievements: [...profile.unlockedAchievements, ach.id] });
        setBuyingId(null);
      }
    };

    const uCount = profile.unlockedAchievements.length;
    let dTarget = uCount >= 9 ? 10 : uCount >= 5 ? 9 : 5;
    const mPct = (uCount / dTarget) * 100;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10 pb-32">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep('setup')} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-slate-300 border border-white/5"><ArrowLeft size={24} /></button>
            <div>
              <h2 className="text-4xl font-display font-black text-white uppercase">{mT.museumTitle}</h2>
              <p className="text-slate-400">{mT.museumDesc}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="bg-thai-blue px-6 py-4 rounded-[2rem] border border-white/5 flex items-center gap-4">
              <div className="w-12 h-12 bg-thai-gold/10 rounded-2xl flex items-center justify-center text-thai-gold"><Sparkles size={28} fill="currentColor" /></div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] mb-1">{mT.balance}</p>
                <p className="text-2xl font-black text-white">✧ {profile.points.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(['zh', 'en', 'th'] as const).map(lang => (
                <button key={lang} onClick={() => setMLang(lang)} className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mLang === lang ? 'bg-thai-gold text-thai-navy' : 'bg-white/5 text-slate-400 border border-white/5'}`}>{lang}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-thai-blue p-8 rounded-[2.5rem] border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5"><Gamepad2 size={120} /></div>
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative w-24 h-24 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white/5" />
                <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={251.2} strokeDashoffset={251.2 - (251.2 * Math.min(mPct, 100)) / 100} strokeLinecap="round" className="text-thai-gold transition-all duration-1000" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center"><span className="text-xl font-black text-white">{uCount}/{dTarget}</span></div>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-white mb-1">{mT.discoveryTitle}</h3>
              <p className="text-slate-400">{mT.discoveryProgress(uCount, dTarget, pointsMultiplier.toFixed(2))}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {APP_ACHIEVEMENTS.map((ach, idx) => {
            const unlocked = profile.unlockedAchievements.includes(ach.id);
            const canAfford = profile.points >= ach.price;
            const tierColor = idx < 3 ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' : idx < 6 ? 'border-teal-500/20 bg-teal-500/10 text-teal-400' : idx < 9 ? 'border-amber-500/20 bg-amber-500/10 text-amber-400' : 'border-rose-500/20 bg-rose-500/10 text-rose-400';
            const regionName = idx < 3 ? mT.regions.exploring : idx < 6 ? mT.regions.southern : idx < 9 ? mT.regions.northern : mT.regions.ultimate;
            return (
              <motion.div key={ach.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className={`rounded-[2.25rem] border-2 p-6 flex flex-col gap-4 transition-all ${unlocked ? 'bg-thai-blue border-white/5 shadow-xl hover:-translate-y-1' : 'bg-white/5 border-white/5 opacity-80'}`}>
                <div className="flex justify-between items-start">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${tierColor}`}>{regionName}</span>
                  {!unlocked && <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-400">✧ {ach.price.toLocaleString()}</span>}
                </div>
                {/* ✅ 成就馆用 dicebear 图案作为装饰，不需要 AI 生成图片 */}
                <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-white/5">
                  <img src={`https://api.dicebear.com/7.x/shapes/svg?seed=${ach.id}&backgroundColor=0b1120`} alt="" className={`w-full h-full object-cover p-8 ${!unlocked ? 'opacity-20 blur-sm' : ''}`} />
                  {!unlocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Sparkles size={40} className="opacity-10 animate-pulse mb-2" />
                      <p className="text-[10px] font-black uppercase text-white/20">{mLang === 'zh' ? '未探索' : mLang === 'th' ? 'ซ่อน' : 'Hidden'}</p>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <h3 className={`text-lg font-black ${unlocked ? 'text-white' : 'text-slate-500'}`}>{unlocked ? ach.specialty[mLang] : ach.province[mLang]}</h3>
                  <p className={`text-sm leading-relaxed ${unlocked ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                    {unlocked ? ach.description[mLang] : (mLang === 'zh' ? `解锁探索${ach.province[mLang]}` : mLang === 'th' ? `ปลดล็อก${ach.province[mLang]}` : `Unlock ${ach.province[mLang]}`)}
                  </p>
                  {unlocked ? (
                    <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-400"><CheckCircle2 size={14} /><span className="text-[10px] font-black uppercase">{mLang === 'zh' ? '已解锁' : mLang === 'th' ? 'ปลดล็อก' : 'Unlocked'}</span></div>
                      <span className="text-[10px] font-black text-thai-gold bg-thai-gold/10 px-2 py-1 rounded-lg">x{ach.buff?.value.toFixed(2)}</span>
                    </div>
                  ) : (
                    <button disabled={!canAfford || buyingId === ach.id} onClick={() => handleBuy(ach)}
                      className={`mt-auto w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${canAfford ? 'bg-thai-gold text-thai-navy hover:bg-white active:scale-95' : 'bg-white/10 text-slate-500 cursor-not-allowed'}`}>
                      {buyingId === ach.id ? <Loader2 className="animate-spin" size={18} /> : <><Sparkles size={16} />{mT.unlockWith} ✧ {ach.price.toLocaleString()}</>}
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
            <div className="w-10 h-10 bg-thai-gold rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Sparkles className="text-thai-navy" size={20} /></div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-display font-black text-white">Sawasdee<span className="text-thai-gold italic">!</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 -mt-1">Thai Language Tutor</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-3 px-3 py-2 bg-white/5 rounded-2xl border border-white/10">
                <span className="text-amber-500">🔥</span><span className="text-sm font-bold text-thai-gold">{profile.streak || 0}</span>
                <div className="w-px h-4 bg-white/10" />
                <span className="text-[10px] text-slate-400">✧</span><span className="text-sm font-bold text-slate-300">{profile.points || 0}</span>
              </div>
            )}
            <div className="flex bg-white/5 p-1 rounded-[1.25rem] border border-white/10">
              <button onClick={() => setStep('setup')} className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${step !== 'museum' ? 'bg-thai-gold text-thai-navy' : 'text-slate-400 hover:text-white'}`}>
                <Home size={20} /><span className="text-xs font-bold hidden md:block">{currentT.home}</span>
              </button>
              <button onClick={() => setStep('museum')} className={`p-2.5 rounded-xl transition-all flex items-center gap-2 ${step === 'museum' ? 'bg-thai-gold text-thai-navy' : 'text-slate-400 hover:text-white'}`}>
                <Gamepad2 size={20} /><span className="text-xs font-bold hidden md:block">{currentT.museum}</span>
              </button>
            </div>
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                {user.photoURL && <img src={user.photoURL} alt="" className="w-9 h-9 rounded-full border-2 border-thai-gold" />}
                <button onClick={handleLogout} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5"><RotateCcw size={18} /></button>
              </div>
            ) : (
              <button onClick={handleLogin} className="flex items-center gap-2 px-4 py-2.5 bg-thai-gold text-thai-navy rounded-2xl font-bold hover:bg-white transition-all">
                <User size={18} /><span className="hidden sm:inline">{currentT.login}</span>
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
                <p className="text-slate-400">{currentT.setupDesc}</p>
              </div>
              <div className="bg-thai-blue rounded-[3rem] p-10 shadow-2xl border border-white/5 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><User size={16} className="text-thai-gold" />{currentT.age}</label>
                    <div className="relative">
                      <select value={profile.age || ''} onChange={(e) => setProfile({ ...profile, age: e.target.value || null })} className="w-full px-5 py-4 rounded-2xl border border-white/10 outline-none appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        <option value="" className="bg-thai-navy">— —</option>
                        {Object.entries(currentT.ageCategories).map(([k, v]) => <option key={k} value={k} className="bg-thai-navy">{v}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Languages size={16} className="text-thai-gold" />{currentT.auxLang}</label>
                    <select value={profile.auxiliaryLanguage} onChange={(e) => setProfile({ ...profile, auxiliaryLanguage: e.target.value as AuxiliaryLanguage })} className="w-full px-5 py-4 rounded-2xl border border-white/10 outline-none appearance-none bg-white/5 font-bold text-white cursor-pointer">
                      <option value="zh" className="bg-thai-navy">中文</option>
                      <option value="en" className="bg-thai-navy">English</option>
                      <option value="th" className="bg-thai-navy">ภาษาไทย</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Settings size={16} className="text-thai-gold" />{currentT.difficulty}</label>
                    <div className="relative">
                      <select value={profile.difficulty} onChange={(e) => setProfile({ ...profile, difficulty: e.target.value as Difficulty })} className="w-full px-5 py-4 rounded-2xl border border-white/10 outline-none appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {(['Foundations', 'Elementary', 'Intermediate', 'Advanced'] as Difficulty[]).map(l => <option key={l} value={l} className="bg-thai-navy">{currentT.levels[l]}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <p className="text-[12px] text-slate-400 italic px-1">{currentT.levelDescriptions[profile.difficulty]}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Sparkles size={16} className="text-thai-gold" />{currentT.focus}</label>
                    <div className="relative">
                      <select value={profile.focus} onChange={(e) => setProfile({ ...profile, focus: e.target.value as LearningFocus })} className="w-full px-5 py-4 rounded-2xl border border-white/10 outline-none appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {(['Listening', 'Speaking', 'Reading', 'Writing', 'Comprehensive'] as LearningFocus[]).map(f => <option key={f} value={f} className="bg-thai-navy">{currentT.focuses[f]}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <p className="text-[12px] text-slate-400 italic px-1">{currentT.focusDescriptions[profile.focus]}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><CheckCircle2 size={16} className="text-thai-gold" />{currentT.dailyGoal}</label>
                    <div className="relative">
                      <select value={profile.dailyGoal} onChange={(e) => setProfile({ ...profile, dailyGoal: parseInt(e.target.value) })} className="w-full px-5 py-4 rounded-2xl border border-white/10 outline-none appearance-none bg-white/5 font-bold text-white cursor-pointer">
                        {[1, 3, 5, 10].map(g => <option key={g} value={g} className="bg-thai-navy">{g} {profile.auxiliaryLanguage === 'zh' ? '课时' : profile.auxiliaryLanguage === 'th' ? 'บทเรียน' : 'Lessons'}</option>)}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                    <p className="text-[12px] font-black text-thai-gold/80 px-1">{currentT.goalRewardLabel(calculatePointsReward(profile.dailyGoal, false))}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Gamepad2 size={16} className="text-thai-gold" />{currentT.topicLabel}</label>
                    <input type="text" value={profile.topic} onChange={(e) => setProfile({ ...profile, topic: e.target.value })} placeholder={currentT.topicPlaceholder} className="w-full px-5 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none font-bold text-white placeholder:text-slate-600" />
                  </div>
                </div>

                {/* API Key 选择 */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-black text-slate-400 uppercase tracking-widest"><Key size={16} className="text-thai-gold" />{currentT.apiKeyLabel}</label>
                  <div className="flex gap-3">
                    {availableKeys.filter(k => k.available).map(k => (
                      <button key={k.index} onClick={() => handleKeySelect(k.index)}
                        className={`flex-1 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all border-2 ${selectedKeyIndex === k.index ? 'bg-thai-gold text-thai-navy border-thai-gold' : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/30'}`}>
                        <Key size={14} />{k.label}{selectedKeyIndex === k.index && <CheckCircle2 size={14} />}
                      </button>
                    ))}
                    {availableKeys.every(k => !k.available) && <p className="text-sm text-red-400 font-bold">未检测到 API Key</p>}
                  </div>
                </div>

                <button onClick={() => handleStart()} className="w-full bg-thai-gold hover:scale-[1.02] active:scale-95 text-thai-navy font-black py-5 rounded-[2rem] shadow-xl transition-all flex items-center justify-center gap-2 group">
                  {currentT.generateBtn}<ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>

                {error && <p className="text-red-500 text-center text-sm">{error}</p>}
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
                <h3 className="text-2xl font-display font-black text-white uppercase">{loadingText || currentT.loadingWriting}</h3>
                <p className="text-slate-400 mt-2">{isKid ? currentT.loadingMagic : currentT.loadingAI}</p>
              </div>
            </motion.div>
          )}

          {step === 'learning' && lesson && (
            <motion.div key="learning" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              <div className={`p-10 rounded-[2.5rem] shadow-2xl ${isKid ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-thai-blue border border-white/5'}`}>
                <div className="flex items-center justify-between mb-6">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border ${isKid ? 'bg-black/10 border-black/10 text-thai-navy' : 'bg-white/5 border-white/10 text-white'}`}>
                    {currentT.levels[profile.difficulty]} • {currentT.focuses[profile.focus]}
                  </span>
                  <button onClick={() => handleStart(true)} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 ${isKid ? 'bg-thai-navy text-white' : 'bg-thai-gold text-thai-navy hover:bg-white'}`}>
                    {currentT.nextLesson}
                  </button>
                </div>
                <h2 className={`text-4xl font-display font-black mb-4 uppercase ${isKid ? 'text-thai-navy' : 'text-white'}`}>{lesson.title}</h2>
                <p className={`text-lg leading-relaxed max-w-3xl ${isKid ? 'text-thai-navy/80' : 'text-slate-300'}`}>{lesson.introduction}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">

                  {/* ✅ 词汇卡片 - 完全去掉图片占位符 */}
                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-2xl font-display font-black flex items-center gap-2 text-white uppercase"><Sparkles size={24} className="text-thai-gold" />{currentT.keyVocab}</h3>
                      <AnimatePresence>{audioError && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-xs text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full border border-red-400/20">{audioError}</motion.span>}</AnimatePresence>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {lesson.vocabulary.map((vocab, idx) => (
                        <div key={idx} className="p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-thai-gold/30 transition-all">
                          <div className="flex items-start justify-between mb-4">
                            <span className="text-3xl font-black text-thai-gold">{vocab.thai}</span>
                            <button onClick={() => playAudio(vocab.thai, vocab.audioText)} disabled={loadingAudio === vocab.thai}
                              className={`p-3 rounded-full transition-all ${loadingAudio === vocab.thai ? 'bg-thai-gold/20 text-thai-gold animate-pulse' : 'bg-white/5 text-slate-400 hover:text-thai-gold hover:bg-white/10'}`}>
                              {loadingAudio === vocab.thai ? <Loader2 size={18} className="animate-spin" /> : <Volume2 size={18} />}
                            </button>
                          </div>
                          <p className="text-xs font-mono text-slate-500 mb-1 tracking-wider uppercase">{vocab.phonetic}</p>
                          <p className="text-lg font-black text-white mb-3">{vocab.translation}</p>
                          <div className="text-xs space-y-1 pt-3 border-t border-white/5">
                            <p className="text-slate-400 italic">"{vocab.example.thai}"</p>
                            <p className="text-slate-500">({vocab.example.translation})</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 阅读 */}
                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-2 text-white uppercase"><BookOpen size={24} className="text-thai-gold" />{currentT.reading}</h3>
                    <div className="space-y-6">
                      {lesson.content.map((item, idx) => (
                        <div key={idx} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
                          <div className="flex items-start justify-between gap-4">
                            <p className="text-xl font-black text-thai-gold mb-2">{item.thai}</p>
                            <button onClick={() => playAudio(item.thai)} disabled={loadingAudio === item.thai} className="p-3 rounded-2xl bg-white/5 text-slate-400 hover:text-thai-gold hover:bg-white/10 transition-all flex-shrink-0">
                              {loadingAudio === item.thai ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                            </button>
                          </div>
                          <p className="text-lg text-slate-400 italic">{item.translation}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 练习 */}
                  <section className="bg-thai-blue rounded-[2.5rem] p-10 shadow-xl border border-white/5">
                    <h3 className="text-2xl font-display font-black mb-8 flex items-center gap-2 text-white uppercase"><Gamepad2 size={24} className="text-thai-gold" />{currentT.interactive}</h3>
                    <div className="space-y-10">
                      {lesson.exercise.map((ex, idx) => (
                        <div key={idx} className="space-y-5">
                          <div className="flex items-start justify-between gap-4 border-l-4 border-thai-gold pl-6">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between gap-4">
                                <p className="text-lg font-black text-white">{idx + 1}. {ex.question.thai}</p>
                                <button onClick={() => playAudio(ex.question.thai)} disabled={loadingAudio === ex.question.thai} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-thai-gold transition-all flex-shrink-0">
                                  {loadingAudio === ex.question.thai ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
                                </button>
                              </div>
                              {showExerciseTranslations[idx] && (
                                <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-slate-400 italic">{ex.question.translation}</motion.p>
                              )}
                            </div>
                            <button onClick={() => setShowExerciseTranslations(prev => ({ ...prev, [idx]: !prev[idx] }))} className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 flex-shrink-0 border border-white/5">
                              <Languages size={18} />
                            </button>
                          </div>
                          {ex.options ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {ex.options.map((opt, oi) => (
                                <button key={oi} onClick={() => setAnswers({ ...answers, [idx]: opt })}
                                  className={`p-4 rounded-2xl text-left text-sm font-black transition-all border-2 ${answers[idx] === opt ? 'bg-thai-gold text-thai-navy border-thai-gold' : 'bg-white/5 text-slate-300 border-white/10 hover:border-white/20'}`}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <input type="text" value={answers[idx] || ''} onChange={(e) => setAnswers({ ...answers, [idx]: e.target.value })} placeholder={currentT.placeholderAnswer} className="w-full px-6 py-4 rounded-2xl bg-white/5 border border-white/10 outline-none text-white font-bold" />
                          )}
                          {showResults && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className={`p-5 rounded-[2rem] border-2 ${answers[idx]?.toLowerCase() === ex.answer.toLowerCase() ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-red-400/10 text-red-400 border-red-400/20'}`}>
                              <div className="flex items-center gap-3 mb-2 font-black uppercase">
                                {answers[idx]?.toLowerCase() === ex.answer.toLowerCase() ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                                {currentT.correctAnswer}: {ex.answer}
                              </div>
                              <div className="pl-8 border-l border-white/10 space-y-1">
                                <p className="text-white text-sm">{ex.explanation.thai}</p>
                                <p className="text-slate-400 text-xs italic">({ex.explanation.translation})</p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>

                    {!showResults ? (
                      <button onClick={handleFinishLesson} className="mt-10 w-full py-5 bg-thai-gold text-thai-navy font-black rounded-3xl hover:bg-white transition-all active:scale-95">{currentT.submit}</button>
                    ) : (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-10 p-10 bg-thai-blue rounded-[3rem] border-2 border-thai-gold text-center space-y-5">
                        <div className="w-16 h-16 bg-thai-gold/10 text-thai-gold rounded-[2rem] flex items-center justify-center mx-auto"><CheckCircle2 size={36} /></div>
                        <h3 className="text-2xl font-display font-black text-white uppercase">
                          {calculateScore() === 100 ? (profile.auxiliaryLanguage === 'zh' ? '完美！' : 'Perfect!') : (profile.auxiliaryLanguage === 'zh' ? '完成！' : 'Done!')}
                        </h3>
                        <p className="text-slate-400 font-bold">
                          {profile.auxiliaryLanguage === 'zh' ? '获得' : 'Earned'} <span className="text-thai-gold font-black">✧ {Math.round((calculateScore() / 10) * pointsMultiplier)}</span> {currentT.pointsLabel}
                        </p>
                        <button onClick={() => setStep('setup')} className="w-full py-4 bg-thai-gold text-thai-navy font-black rounded-2xl hover:bg-white transition-all active:scale-95">
                          {profile.auxiliaryLanguage === 'zh' ? '返回首页' : 'Return Home'}
                        </button>
                      </motion.div>
                    )}
                  </section>
                </div>

                <div className="space-y-6">
                  {lesson.culturalNote && (
                    <section className="bg-thai-gold/10 rounded-[2.5rem] p-8 border border-thai-gold/20">
                      <h4 className="text-thai-gold font-black mb-3 flex items-center gap-2 uppercase tracking-widest text-sm"><Sparkles size={18} />{currentT.culturalNote}</h4>
                      <p className="text-slate-200 text-sm leading-relaxed italic">{lesson.culturalNote}</p>
                    </section>
                  )}
                  <section className="bg-thai-blue rounded-[2.5rem] p-8 border border-white/5">
                    <h4 className="font-black mb-5 text-white uppercase tracking-widest text-sm">{currentT.progress}</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase">
                        <span>{currentT.focuses[profile.focus]}</span>
                        <span className="text-thai-gold">{Math.round(((profile.lessonsCompletedToday % profile.dailyGoal) / profile.dailyGoal) * 100)}%</span>
                      </div>
                      <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div className="h-full bg-thai-gold rounded-full transition-all duration-1000" style={{ width: `${Math.round(((profile.lessonsCompletedToday % profile.dailyGoal) / profile.dailyGoal) * 100)}%` }} />
                      </div>
                      <p className="text-[11px] text-slate-500 font-bold uppercase">{currentT.milestone(profile.lessonsCompletedToday)}</p>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-16 border-t border-white/5 mt-16 bg-black/20">
        <p className="text-center text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">© 2026 Sawasdee Learn • Powered by Gemini AI</p>
      </footer>
    </div>
  );
}
