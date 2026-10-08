import { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

// Shown above the chat only when the portal requires wallet sign-in
// (CHATBOT_REQUIRE_SIGNIN) and there is something to say: no wallet is
// connected yet, the wallet is waiting for the signature, or it failed.
// Signing itself starts when the first question is sent.
export default function SigninBar({
  busy,
  error
}: {
  busy: boolean
  error: string | null
}): ReactElement {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d0d2dd] bg-white px-4 py-3 text-sm">
      <span className="flex-1 min-w-[200px]">
        {busy ? t('chatbot.signinBusy') : t('chatbot.signinNeeded')}
      </span>
      {error && (
        <span role="alert" className="w-full text-red-700">
          {error}
        </span>
      )}
    </div>
  )
}
