/**
 * Growfy LaunchOS — Google Sheets Service
 * Lê planilhas via Service Account (server-only). Aceita:
 *   Opção 1 (recomendada, à prova de erro):
 *     GOOGLE_SA_JSON_B64 = base64 do arquivo JSON inteiro da SA
 *   Opção 2 (legado):
 *     GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY
 *
 * A planilha alvo precisa estar compartilhada com o email da SA como Viewer.
 */
import { google } from "googleapis";

export interface SheetRange {
  sheetId: string;
  range: string; // ex: "Leads!A2:N"
}

/**
 * Normaliza a private key pra tolerar variações de como foi colada no env:
 *   - Envolvida em aspas duplas ou simples (remove)
 *   - Com `\n` literal em vez de newline real (converte)
 *   - Com newlines reais preservadas (mantém)
 */
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  if (!key.endsWith("\n")) {
    key += "\n";
  }
  return key;
}

interface SAJson {
  client_email: string;
  private_key: string;
}

function loadFromJsonB64(): SAJson | null {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  if (!b64) return null;
  try {
    const json = Buffer.from(b64.trim(), "base64").toString("utf-8");
    const parsed = JSON.parse(json) as SAJson;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("JSON não contém client_email/private_key");
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `GOOGLE_SA_JSON_B64 inválido: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function loadFromSeparateEnv(): SAJson | null {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) return null;
  const privateKey = normalizePrivateKey(rawKey);
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY inválida: não contém marcadores BEGIN/END PRIVATE KEY."
    );
  }
  return { client_email: email, private_key: privateKey };
}

function getAuth() {
  const creds = loadFromJsonB64() ?? loadFromSeparateEnv();
  if (!creds) {
    throw new Error(
      "Google Service Account não configurada. Defina GOOGLE_SA_JSON_B64 (recomendado) ou GOOGLE_SA_CLIENT_EMAIL + GOOGLE_SA_PRIVATE_KEY."
    );
  }
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

/**
 * Retorna metadados seguros da chave configurada (não expõe a chave em si).
 * Uso: endpoint de diagnóstico.
 */
export function diagnoseCredentials() {
  const b64 = process.env.GOOGLE_SA_JSON_B64;
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;

  const out: Record<string, unknown> = {
    hasJsonB64: Boolean(b64),
    hasSeparateVars: Boolean(email && rawKey),
    resolvedFrom: b64 ? "GOOGLE_SA_JSON_B64" : email && rawKey ? "SEPARATE_VARS" : "NONE",
  };

  try {
    const creds = loadFromJsonB64() ?? loadFromSeparateEnv();
    if (creds) {
      const key = creds.private_key;
      out.clientEmail = creds.client_email;
      out.privateKey = {
        length: key.length,
        hasBeginMarker: key.includes("BEGIN PRIVATE KEY"),
        hasEndMarker: key.includes("END PRIVATE KEY"),
        realNewlineCount: (key.match(/\n/g) ?? []).length,
        literalBackslashN: rawKey ? rawKey.includes("\\n") : false,
        startsWith: key.slice(0, 30),
        endsWith: key.slice(-30),
      };
    }
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }

  return out;
}

export async function getSheetRows({ sheetId, range }: SheetRange): Promise<string[][]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  });
  const values = (res.data.values ?? []) as unknown[][];
  return values.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));
}
