import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Dotenv converts \n in double-quoted env values to actual newlines.
// JSON.parse rejects actual newlines inside string literals.
// This function escapes newlines only within JSON string values, leaving
// structural whitespace (between keys) untouched.
function parseServiceAccount(raw: string): object {
  let inString = false;
  let escaped = false;
  let result = "";

  for (const char of raw) {
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === "\\" && inString) {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString && char === "\n") {
      result += "\\n";
      continue;
    }
    if (inString && char === "\r") {
      result += "\\r";
      continue;
    }
    result += char;
  }

  return JSON.parse(result);
}

export function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount(
      process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT!
    );
    initializeApp({ credential: cert(serviceAccount) });
    getFirestore().settings({ ignoreUndefinedProperties: true });
  }
  return getFirestore();
}
