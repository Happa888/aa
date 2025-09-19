import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { firebaseConfig } from './firebase';

const app = initializeApp(firebaseConfig);
export const realtimeDb = getDatabase(app);
