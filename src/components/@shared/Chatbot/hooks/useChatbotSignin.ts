import { useCallback, useEffect, useState } from 'react'
import { useAccount, useSigner } from 'wagmi'

// Wallet sign-in for the chatbot (src/pages/api/chatbot/signin.ts). When the
// portal does not require it, `required` stays false and nothing is shown.
export function useChatbotSignin(): {
  required: boolean
  signedIn: boolean
  busy: boolean
  error: string | null
  hasWallet: boolean
  signIn: () => Promise<void>
} {
  const { address } = useAccount()
  const { data: signer } = useSigner()
  const [required, setRequired] = useState(false)
  const [signedInAs, setSignedInAs] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const query = address ? `?address=${address}` : ''
    fetch(`/api/chatbot/signin${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        setRequired(Boolean(d.required))
        setSignedInAs(d.address || null)
        setMessage(d.message || null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [address])

  const signIn = useCallback(async () => {
    if (!signer || !message) return
    setBusy(true)
    setError(null)
    try {
      const signature = await signer.signMessage(message)
      const r = await fetch('/api/chatbot/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, signature })
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `sign-in failed (${r.status})`)
      setSignedInAs(d.address)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }, [signer, message])

  const signedIn =
    !required ||
    (!!signedInAs &&
      !!address &&
      signedInAs.toLowerCase() === address.toLowerCase())

  return { required, signedIn, busy, error, hasWallet: !!signer, signIn }
}
