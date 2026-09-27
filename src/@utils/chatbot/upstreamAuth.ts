import getConfig from 'next/config'

// サーバー側（/api/chatbot/*）からチャットボットを呼ぶときの共有鍵。
// Sepolia 試用環境のチャットボット（deploy/ocean-node/chatbot/server.py）は
// この鍵が無い要求を断る。CHATBOT_API_KEY が無ければ何も足さない
// （upstream の運用はこれまでどおり）。ブラウザには出さない。
//
// Vercel 上では関数の process.env に値が現れなかった（2026-09-27 実測。
// チャットボット側の記録で「鍵なし」）。contact-resend.ts と同じく
// serverRuntimeConfig（next.config.js）から読み、無ければ process.env を見る。
export function chatbotAuthHeaders(): Record<string, string> {
  const { serverRuntimeConfig } = getConfig() || {}
  const key =
    serverRuntimeConfig?.CHATBOT_API_KEY || process.env.CHATBOT_API_KEY
  return key ? { 'X-Chatbot-Key': key } : {}
}
