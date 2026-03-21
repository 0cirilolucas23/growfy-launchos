import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  AuthError,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

// ─────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AuthResult {
  user: User | null;
  error: string | null;
}

// ─────────────────────────────────────────────
// Error messages in Portuguese
// ─────────────────────────────────────────────

function parseAuthError(error: AuthError): string {
  const messages: Record<string, string> = {
    "auth/user-not-found": "Usuário não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/email-already-in-use": "Este e-mail já está em uso.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/popup-closed-by-user": "Login cancelado.",
    "auth/network-request-failed": "Erro de conexão. Tente novamente.",
    "auth/too-many-requests": "Muitas tentativas. Tente mais tarde.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
  };
  return messages[error.code] ?? "Erro inesperado. Tente novamente.";
}

// ─────────────────────────────────────────────
// Auth Functions
// ─────────────────────────────────────────────

export async function signInWithGoogle(): Promise<AuthResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return { user: result.user, error: null };
  } catch (err) {
    return { user: null, error: parseAuthError(err as AuthError) };
  }
}

export async function resetPassword(email: string): Promise<{ error: string | null }> {
  try {
    await sendPasswordResetEmail(auth, email);
    return { error: null };
  } catch (err) {
    return { error: parseAuthError(err as AuthError) };
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, auth };
export type { User };
