/**
 * Growfy LaunchOS — Google Sheets Service
 * Lê planilhas via Service Account (server-only). Requer env vars:
 *   GOOGLE_SA_CLIENT_EMAIL, GOOGLE_SA_PRIVATE_KEY
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

function getAuth() {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Google Service Account não configurada (GOOGLE_SA_CLIENT_EMAIL / GOOGLE_SA_PRIVATE_KEY)");
  }
  const privateKey = normalizePrivateKey(rawKey);
  if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
    throw new Error(
      "GOOGLE_SA_PRIVATE_KEY inválida: não contém marcadores BEGIN/END PRIVATE KEY. Cole a chave completa incluindo -----BEGIN PRIVATE KEY----- e -----END PRIVATE KEY-----."
    );
  }
  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
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
