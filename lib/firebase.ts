// ========================================
// GROWFY LAUNCHOS - Firebase Configuration
// ========================================
// 
// Inicialização segura do Firebase com TypeScript
// Suporta: Firestore, Authentication, Storage
//
// ========================================

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// ----------------------------------------
// TYPES
// ----------------------------------------

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// ----------------------------------------
// ENVIRONMENT VARIABLES VALIDATION
// ----------------------------------------

/**
 * Valida e retorna a configuração do Firebase
 * Lança erro se variáveis críticas estiverem ausentes
 */
const getFirebaseConfig = (): FirebaseConfig => {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ];

  // Verificar se todas as variáveis estão presentes
  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.error(
      '🔥 [FIREBASE ERROR] Variáveis de ambiente ausentes:',
      missingVars
    );
    console.error(
      '💡 [FIREBASE HINT] Certifique-se de que o arquivo .env.local existe e contém todas as variáveis.'
    );
    console.error(
      '📝 [FIREBASE HINT] Copie .env.example para .env.local e preencha as credenciais.'
    );
    
    throw new Error(
      `Firebase configuration missing: ${missingVars.join(', ')}`
    );
  }

  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
};

// ----------------------------------------
// FIREBASE INITIALIZATION
// ----------------------------------------

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  const firebaseConfig = getFirebaseConfig();

  // Prevenir múltiplas inicializações (Next.js hot reload)
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    console.log('✅ [FIREBASE] Inicializado com sucesso');
    console.log('📦 [FIREBASE] Project ID:', firebaseConfig.projectId);
  } else {
    app = getApps()[0];
  }

  // Inicializar serviços
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  // Log de ambiente (apenas em desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 [FIREBASE] Rodando em modo DEVELOPMENT');
  }

} catch (error) {
  console.error('❌ [FIREBASE] Erro fatal na inicialização:', error);
  throw error;
}

// ----------------------------------------
// EXPORTS
// ----------------------------------------

export { app, auth, db, storage };

/**
 * Verifica se o Firebase foi inicializado corretamente
 */
export const isFirebaseInitialized = (): boolean => {
  return !!app && !!auth && !!db;
};

/**
 * Hook de utilidade para verificar inicialização
 * @throws {Error} Se o Firebase não estiver inicializado
 */
export const ensureFirebaseInitialized = (): void => {
  if (!isFirebaseInitialized()) {
    throw new Error(
      'Firebase não inicializado. Verifique as variáveis de ambiente.'
    );
  }
};
