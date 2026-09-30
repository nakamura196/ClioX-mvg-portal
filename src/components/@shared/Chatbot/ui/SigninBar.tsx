import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

// Shown above the input box only when the portal requires wallet sign-in for
// the chatbot (CHATBOT_REQUIRE_SIGNIN) and this wallet has not signed in yet.
export default function SigninBar({
  busy,
  error,
  hasWallet,
  signIn
}: {
  busy: boolean
  error: string | null
  hasWallet: boolean
  signIn: () => Promise<void>
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-[#d0d2dd] bg-white px-4 py-3 text-sm">
      <span className="flex-1 min-w-[200px]">
        {hasWallet ? t('chatbot.signinNeeded') : t('chatbot.connectFirst')}
      </span>
      {hasWallet && (
        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="rounded-md bg-[#1a1a2e] px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? t('chatbot.signinBusy') : t('chatbot.signinButton')}
        </button>
      )}
      {error && (
        <span role="alert" className="w-full text-red-700">
          {error}
        </span>
      )}
    </div>
  )
}
