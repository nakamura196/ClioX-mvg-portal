import type { NextApiRequest, NextApiResponse } from 'next'
import {
  clearSigninCookie,
  setSigninCookie,
  signedInAddress,
  signinMessage,
  signinRequired,
  verifySignin
} from '../../../@utils/chatbot/signin'

// GET    ?address=0x…  → { required, address, message }  (message: text to sign)
// POST   { message, signature } → { address } and the sign-in cookie
// DELETE                → signs out
// Everything answers { required: false } when CHATBOT_REQUIRE_SIGNIN is off.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const required = signinRequired()
  if (req.method === 'GET') {
    if (!required) return res.status(200).json({ required })
    const address = signedInAddress(req)
    const wanted =
      typeof req.query.address === 'string' ? req.query.address : ''
    let message: string | undefined
    try {
      if (wanted) message = signinMessage(req, wanted)
    } catch {
      return res.status(400).json({ error: 'invalid address' })
    }
    return res.status(200).json({ required, address, message })
  }
  if (req.method === 'POST') {
    if (!required) return res.status(200).json({ required })
    const { message, signature } = req.body || {}
    if (typeof message !== 'string' || typeof signature !== 'string')
      return res.status(400).json({ error: 'message and signature required' })
    try {
      const address = verifySignin(req, message, signature)
      setSigninCookie(res, address)
      return res.status(200).json({ required, address })
    } catch (e) {
      return res.status(401).json({ error: (e as Error).message })
    }
  }
  if (req.method === 'DELETE') {
    clearSigninCookie(res)
    return res.status(200).json({ required, address: null })
  }
  res.setHeader('Allow', 'GET, POST, DELETE')
  return res.status(405).json({ error: 'Method not allowed' })
}
