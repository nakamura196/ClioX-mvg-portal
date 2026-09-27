// Sepolia 試用環境（cliox.ldas.jp）の標本。公開は deploy/trial/usecases.zsh。
// 知識を作るアルゴリズムは deploy/trial/algorithm/chatbot_knowledge.py。
export const TRIAL_CHATBOT_ALGO_DIDS: Record<number, string> = {
  11155111:
    'did:op:4178768987eb40f3639ca75bb17fa7efd41476cbd957379dde54c6bc6d1b326f'
}

export const TRIAL_CHATBOT_DATASET_DIDS: Record<number, string[]> = {
  11155111: [
    // The Federalist Papers, 85 essays
    'did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c',
    // Declaration of Independence（最初の試用で公開したもの）
    'did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787'
  ]
}

export const CHATBOT_NAMESPACE = 'chatbot:trial'
