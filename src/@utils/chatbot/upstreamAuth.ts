// サーバー側（/api/chatbot/*）からチャットボットを呼ぶときの共有鍵。
// Sepolia 試用環境のチャットボット（deploy/ocean-node/chatbot/server.py）は
// この鍵が無い要求を断る。CHATBOT_API_KEY が無ければ何も足さない
// （upstream の運用はこれまでどおり）。ブラウザには出さない。
export function chatbotAuthHeaders(): Record<string, string> {
  const key = process.env.CHATBOT_API_KEY
  return key ? { 'X-Chatbot-Key': key } : {}
}
