import { getErrorMessage } from '@oceanprotocol/lib'

/**
 * Ocean lib の getErrorMessage() は引数を JSON.parse する前提で書かれている。
 * そのため JSON でないエラーメッセージ（例: "Cannot read properties of
 * undefined (reading 'wait')"）を渡すと SyntaxError を投げ、**本来のエラーが
 * ログにも画面にも出なくなる**。原因究明が事実上できなくなるので、
 * パースできない場合は元のメッセージをそのまま返す。
 */
export function safeErrorMessage(message: string): string {
  try {
    return getErrorMessage(message)
  } catch {
    return message
  }
}
