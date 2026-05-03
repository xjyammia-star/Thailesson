import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// ✅ 修正：数据库ID优先从环境变量读取
// 如果你在自己的 Firebase 项目里创建了 (default) 数据库，
// 就在 Vercel 环境变量里不设置 VITE_FIREBASE_DB_ID，让它用默认值
// 如果你用的是自定义数据库ID，就在 Vercel 里设置 VITE_FIREBASE_DB_ID
const dbId = (import.meta as any).env?.VITE_FIREBASE_DB_ID
  || firebaseConfig.firestoreDatabaseId
  || '(default)';

export const db = getFirestore(app, dbId);
export const auth = getAuth(app); // ✅ 修正：传入 app 实例，更规范
