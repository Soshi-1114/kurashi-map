// Google Search Console API 認証。サービスアカウントの JWT で
// `webmasters.readonly` スコープのアクセストークンを取得する。
//
// 認証情報は2通りのいずれかで与える（README「認証設定」参照）:
//   1. GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY（.env.local に直接値を入れる）
//   2. GOOGLE_APPLICATION_CREDENTIALS（サービスアカウント JSON ファイルのパス）
// どちらも Git 管理しない（.gitignore 済み）。

import fs from "node:fs";
import { JWT } from "google-auth-library";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function loadServiceAccountKey(): ServiceAccountKey {
  const inlineEmail = process.env.GSC_CLIENT_EMAIL;
  const inlineKey = process.env.GSC_PRIVATE_KEY;
  if (inlineEmail && inlineKey) {
    return { client_email: inlineEmail, private_key: inlineKey.replace(/\\n/g, "\n") };
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error(
      "GSC の認証情報が未設定です。GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY か、" +
        "GOOGLE_APPLICATION_CREDENTIALS（サービスアカウント JSON のパス）を .env.local に設定してください。" +
        "README.md の「GSC 分析ツールの認証設定」を参照。",
    );
  }
  if (!fs.existsSync(keyFile)) {
    throw new Error(`サービスアカウントキーファイルが見つかりません: ${keyFile}`);
  }
  let raw: { client_email?: string; private_key?: string };
  try {
    raw = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
  } catch (e) {
    throw new Error(`サービスアカウントキーファイルの JSON 解析に失敗しました: ${keyFile}: ${String(e)}`);
  }
  if (!raw.client_email || !raw.private_key) {
    throw new Error(`サービスアカウントキーファイルに client_email / private_key がありません: ${keyFile}`);
  }
  return { client_email: raw.client_email, private_key: raw.private_key };
}

let cachedClient: JWT | null = null;

/** アクセストークンを取得。google-auth-library の JWT クライアントが有効期限内は内部でキャッシュする。 */
export async function getAccessToken(): Promise<string> {
  if (!cachedClient) {
    const key = loadServiceAccountKey();
    cachedClient = new JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  }
  const token = await cachedClient.authorize();
  if (!token.access_token) {
    throw new Error(
      "GSC アクセストークンの取得に失敗しました。サービスアカウントに Search Console の権限（プロパティへの " +
        "ユーザー追加）が付与されているか確認してください。",
    );
  }
  return token.access_token;
}
