## TODO — feat/green-real (green choice on real jobs)

Design and decisions: `docs/notes/green-choice-in-production.md`.

Done (2026-11-27): mdx per-vCPU power estimate in
`src/experiment/footprint/lib/computeFootprint.ts` (`options.cpuCount`), test added
(footprint tests 21/21, carbon-choice unchanged).

Next, in order:

1. `src/experiment/green-real/lib/jobImpact.ts` (+ test): read run time / CPUs /
   environment from a real job, estimate it on every real environment of the
   portal's nodes (`chains.config.js` isCustom + providerUri →
   `/api/services/computeEnvironments`), build the job receipt and the
   `CarbonChoiceRecord.record` arguments (reuse `carbon-choice/lib/carbonChoice.ts`).
2. `src/experiment/green-real/JobImpact.tsx`: block in
   `src/components/Profile/History/ComputeJobs/Details.tsx` (one import + one call,
   `// [prototype]`), en/ja; download receipt; "Keep a record" with the wallet.
3. `ImpactSummary.tsx`: running total above the job list
   (`ComputeJobs/index.tsx`).
4. `npm run check:layout`, `npm run lint`, jest; check on `next dev` with a real
   job of the consumer wallet (0x05f1…1085) before any deploy. Show the owner the
   local URL first; no push or deploy without OK.
5. Docs site page (en/ja) per the fork's CLAUDE.md.
6. Second node: owner decides where (see the note, "Second node"). Then add its
   location and power profile to the registry and to `chains.config.js`.

# Clio-X（Sepolia 試用環境）TODO

依頼を受けた順に並べる。終わったら `[x]` にして、日付と結果を 1 行添える。
結果はドキュメント（docs-site）にも書く。

## この作業場所（deploy/hosting）で対応

- [x] 日本語で検索しても結果が出ない（例: 「きりつぼ」）
  - 2026-09-27 検索語がまったく効いていなかった（英語も全件）。1715d358 で修正、公開サイトで「きりつぼ」2 件を確認。docs 43b5dff1
- [ ] ダウンロードすると file.json（エラーの中身）が落ちてくる
  - 原因: MetaMask のスマートアカウントが中継の契約経由で注文を送り、Ocean Node 4.2.0 が「取引の宛先＝データトークン」と決めつけて失敗する
  - ポータル: 失敗時にエラーを表示する（ファイルとして保存しない）
  - ノード: 注文の記録（OrderStarted）からデータトークンを読むよう直す
  - [x] ドキュメント: 原因と回避策（docs 43b5dff1）
- [ ] ダウンロードしたファイル名が本来の名前でなく file.txt になる
- [ ] メタデータを編集し、「メタデータの更新履歴」に「更新」が出るか確かめる
- [ ] 英語のまま・キー名のままの箇所を洗い出して直す（設定画面など）
  - [x] 2026-09-27 プロフィールの「profile.sales」（件数の読み込み中にキー名が出ていた）
- [ ] 初回の試用で登録した源氏の資産（6668… / 7358…）が一覧に残っている。取り下げる

## 別のセッションで対応

- [ ] 可視化（/usecases/visualizations）とチャットボット（/usecases/chatbot）を Sepolia で動かす。追加の手順をドキュメントにする
- [ ] 検証ページ（/verify）の使い方をドキュメントにする
- [ ] 機能ごとのチュートリアル動画
- [x] 補助を「承認した人」だけに出す（EAS。PR #6 で 2026-10-09 に公開済み）
  - [ ] 他の会員の登録: `zsh contracts/carbon-choice/eas-member.zsh attest-file <一覧>`（一覧はリポジトリの外に置く）
- [ ] 差額を誰が出すか、4 通りを切り替えて比べられる試作（ブランチ proto/green-options）
  - 2026-11-06 型 1・型 2 を追加し、Sepolia に配布（0xd8748Aee…DF25）。記録は docs/prototypes/carbon-choice/README.ja.md
  - 残り: PR を出して公開 → 人が MetaMask で払う確認 → 文書サイト（green-choice）の更新 → Vicki 先生たちと相談
