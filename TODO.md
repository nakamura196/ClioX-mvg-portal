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
6. Second place to run: decided 2026-11-27 (owner) — for now a **second compute
   environment in the same Ocean Node on mdx-clio**, with provisional values,
   labelled as such. Oracle (account nakamura196, home region unknown) or a new
   mdx VM later. mdx-clio disk was 97 % full on 2026-11-27: graph-node block cache
   `chain1.blocks` 40 GB. Cleaned 2026-11-27 with the owner's OK (97 % → 52 %, 48 GB
   free) and a weekly cleanup installed (Mon 03:00 JST, `deploy/ocean-node/scripts/
install-cleanup.zsh`, log /opt/cliox-node/cleanup.log). Still to do: a
   known-problems page on docs/site (en/ja); check the log after the first Monday.
   6a. Done 2026-11-27: the node now lists two environments. Second one:
   "Provisional place B …" (id suffix 0xfa68f4b7…), 2 CPU / 2 GB, free jobs 1 at a
   time, same allowed wallets. First one's id unchanged (0x8505cbd8…). Portal
   registry: `provisional-place-b` (30 g/kWh, provisional, labelled) +
   test. Applied by copying only docker-compose.yml (backup on the VM as
   docker-compose.yml.bak-20261127-\*) and `docker compose up -d ocean-node`;
   deploy.zsh was NOT used, because its rsync --delete would remove the .env
   backups and the VM's chatbot/server.py and .env.example are older than this
   branch. Not committed yet (docker-compose.yml, computeFootprint.ts + test).
   Done 2026-11-27: real free job on place B with the consumer wallet (CLI,
   `deploy/ocean-node/scripts/try-place-b-job.zsh`): job
   0xff1004b6…-cddbb725…, finished (70), 1 CPU, 97.627 s. The portal's code
   resolves it to `provisional-place-b` (0.0058 g; the same job on mdx 0.0827 g).
   Still to do: docs/site pages (en/ja) on the two environments — users now have
   to pick one on the compute form (it pre-selects only when there is one), and
   the ch10–ch12 videos show one; check the form on cliox.ldas.jp in Chrome.
   6d. Checked on cliox.ldas.jp 2026-11-27 (Chrome, ch14 dataset page): the compute
   form lists both environments, neither pre-selected. Footprint block (hover the
   (i)): mdx shows Kashiwa / 429 g but "cannot be established" (production lacks the
   per-vCPU power); place B shows "not declared". Both registry changes exist only
   in this worktree (uncommitted). Even after deploy, the form passes no cpuCount
   (`ComputeEnvDetails.tsx` → `<ComputeFootprint computeEnv durationSeconds>`), so
   the per-vCPU estimate will not apply there: pass the env's cpu max (or the
   chosen amount). Then check on `next dev`, show the owner, merge to
   deploy/hosting and deploy only with OK.
   6e. 2026-11-27 local (not committed): the selector now passes cpuCount (cpu
   min) and shows a "dummy data" line for place B; a real-environment table
   ("Compare where to run") sits under the info card when the node lists ≥2
   environments (CompareTable.tsx → RealCompareTable; ?demo=1 still shows the
   4 sample providers). Table row ↔ order box selection stay in sync. Values (1
   vCPU × 15 min): mdx 0.762 g, place B 0.0533 g. Owner is comparing the two
   tables. Local run: `NODE_OPTIONS=--no-experimental-webstorage
   NEXT_PUBLIC_METADATACACHE_URI=https://cliox-node.ldas.jp npx next dev -p 3017`
   (after `npm run pregenerate`; Node 25 breaks SSR without the first flag).
   Rewards: not built yet (item 7).
   6f. Owner 2026-11-27: the real table shows fewer items than the paper's Fig. 1
   (CAS sustainability paper, rev2/overleaf main.tex l.141: location,
   jurisdiction, Indigenous-data suitability, certifications, cost, electricity,
   water, carbon, quality labels, "View the calculation"). Proposed: keep A and B
   as dummy entries in a data file of the same shape as
   content/experiment/trials.json (TrialOption), matched to the node's
   environments by description, and reuse TransactionFootprint + the
   calculation view, so the real table equals the demo/paper. Awaiting the
   owner's OK on the dummy values. Dummy badge fixed; English location/source
   text fixed (both local only).
   2026-11-27 done locally (not committed): A and B live in
   content/experiment/real-envs.json (TrialOption shape + match + dummy list;
   loader src/experiment/footprint/lib/realEnvs.ts, test realEnvs.test.ts).
   The real table now has the demo's columns (location, cost, electricity,
   water, carbon) and the demo's detail block (jurisdiction, Indigenous data,
   certifications, PUE, WUE, labels with "dummy"), and "View the calculation"
   opens /experiment/two-condition?view=receipt&sample=real-b&sec=900&cpu=1.
   Checked in Chrome (1 vCPU, 15 min: A 0.00231 kWh / 0.991 g, B 0.00196 kWh /
   0.0587 g). Left: the receipt page still shows the demo's fixed 1-hour times
   and "shared GPU" wording; the right order box still uses the older block;
   the old Grid/Basis columns are gone (labels are in the detail block).
   6c. Impact values in the node's API: decided 2026-11-27 to keep the portal
   registry for now (the node drops unknown config keys; see the note). Revisit
   when the real second node exists: upstream issue or a patch on both nodes.
   6b. Oracle (third place, owner 2026-11-27): home region ap-osaka-1. Creating
   `cliox-node-osaka` in the console (Ubuntu 24.04, A1.Flex 2 OCPU / 12 GB, vcn01
   public subnet, SSH key ~/.ssh/oracle/id_ed25519 — owner copies the .pub to the
   clipboard). Check the console's "resource limit is critical" warning before
   creating. 2026-11-27: Create failed — "Out of capacity for shape VM.Standard.A1.Flex
   in AD-1" (Osaka has one AD). Existing: orardf-server-instance (E2.1.Micro, stopped,
   2021). Next: retry later, or automate retries with the OCI CLI (needs an API key
   in 1Password). Meanwhile build the two environments on mdx-clio.
7. Reward contract + claim. Owner OK 2026-11-27 (start: PLAY from a sponsor pool,
   rule changeable). Done locally, not committed:
   - contracts/carbon-choice/src/GreenReward.sol (+ test, 6 pass): one claim per
     jobIdHash, pays the job owner (highestUg − chosenUg) × unitsPerMg / 1000,
     capped; rate/cap/token/checker settable by the owner.
   - worker/greenReward.ts (+ greenReward.test.mjs, 4 pass): reads the job from
     the node (owner, env, algo start/stop, vCPU), estimates every real env with
     content/experiment/real-envs.json, signs (EIP-191). The node ignores an
     unknown jobId and returns a list, so the checker matches jobId exactly.
   - contracts/carbon-choice/try-reward-local.zsh <jobId>: anvil end-to-end with
     the real place-B job: 101.169 PLAY to 田中, second claim refused. ✓
     2026-11-27 done: checker key created (1Password "Clio-X Sepolia green reward
     checker", 0x5A3f…a3Eb, no funds); GreenReward on Sepolia
     0x428745BC1aa9B5465A211742f5Dde111340CD3A0 (owner = trial wallet = operator,
     PLAY, 1 PLAY/mg, cap 500), pool 1,000 PLAY (contracts/carbon-choice/
     deploy-green-reward.zsh). Pitfall: forge's local simulation underestimates
     creation gas on Sepolia (chain estimate 5.38M vs simulated ~0.8M); two
     attempts ran out of gas (0x6827…, 0x0b76…, no PLAY moved). Use
     --skip-simulation so the RPC estimates. Owner decided: trial wallet = operator
     (written in ~/git/web3/CLAUDE.md); checker = separate signing-only key.
     Next: (b) POST /api/green-reward/quote in worker/index.ts (secret
     GREEN_REWARD_CHECKER_KEY, var GREEN_REWARD_CONTRACT); (c) "Receive the reward"
     button in the job details; (d) 田中's wallet end to end on Sepolia (local
     portal first, no deploy without OK). Also: receipt page leftovers (6f).
     2026-11-27 (b)(c)(d) done locally, not committed:
   - (b) worker/index.ts POST /api/green-reward/quote → handleQuoteBody in
     worker/greenReward.ts (node URL and contract fixed in code/vars, never from
     the request). Dev twin: src/pages/api/green-reward/quote.ts (reads
     process['env']: this build turns `process.env.NAME` into undefined in API
     routes). Start locally with `zsh scripts/dev-green-reward.zsh` (reads the
     checker key from 1Password into the dev server's env only).
   - (c) src/experiment/green-reward/ClaimBox.tsx in the compute job details
     (finished jobs): asks for the quote, reads amount + "claimed" from the
     contract, sends claim() from the connected wallet. en/ja inline.
   - (d) 田中 end to end on Sepolia through the local portal (headless browser
     with ~/git/blog/cliox/scripts/lib/wallet.mjs, script
     ~/git/blog/cliox/scripts/probe/green-reward-claim.mjs): place-B job
     cddbb725…, mdx 107.53 mg / B 6.36 mg → 101.169 PLAY to 0x05f1…C085,
     tx 0x9191bb5f3fdd6de363294ccef9b85c420791d5bf992eb194f52414dd7d921639.
     Pool now 898.831 PLAY. Reopening the job shows "already received".
     Before production: set the secret on the Worker
     (`op item get 'Clio-X Sepolia green reward checker' --vault Personal --fields
private_key --reveal | tr -d '\n' | npx wrangler secret put
GREEN_REWARD_CHECKER_KEY`), merge into deploy/hosting, deploy only with OK.
     Docs (en/ja): how the reward works, with the tx above (item 8 too).
     Small: the job details show "(名称不明)(DID なし)" for this job (existing).
     2026-11-27 profile line (owner OK): src/experiment/green-reward/ProfileRewards.tsx
     under the profile stats — total PLAY received (Claimed events for the address,
     from the deploy block 12225716) and PLAY balance, link to Blockscout. Checked
     on 田中's profile: "受け取った合計 101.169 PLAY（1 件） 財布の PLAY 残高 101.169".
     Note: getLogs from the deploy block to latest; if the RPC caps the range later,
     page the query.
     2026-11-27 job for the video (田中, place B, NOT claimed — keep it for the
     recording): 0xff1004b6…-f36940052fc8d04addb418a1a91bd58e11f6ac6d8f2a7263d8654ae7d6205761,
     finished 70, exitCode 0, 99.2 s. Claim it on the redeployed contract.
     2026-11-27 REDEPLOYED (hardened): GreenReward 0x5e80A701fc5Cb3Bd1c3aC77fD510D0B2B202fD40
     (block 12225869). Zero checker/token/owner rejected, zero signer rejected,
     received/receivedCount per address, importClaimed (the first claim carried
     over: received(0x05f1…C085) = 101.169). Pool moved: 898.831 PLAY in the new
     contract, old 0x4287…D3A0 emptied. txs: create 0xbb84acbd…, import 0x0fa43302…,
     withdraw 0x79bb9573…, transfer 0x52656797…. forge 53 pass; TS + forge share the
     fixed digest vector 0xd0cb6d5f…788c. Portal points at the new address
     (worker/greenReward.ts GREEN_REWARD_DEFAULTS, used by ProfileRewards, which now
     reads received/receivedCount: no getLogs). Checked locally: profile line OK,
     quote for the video job f3694005… = mdx 109.31 mg / B 6.47 mg (not claimed).
     NEXT (ask the owner first, show the local URL): commit feat/green-real, merge
     into deploy/hosting (check that worktree for others' uncommitted work), put
     GREEN_REWARD_CHECKER_KEY on the Worker, deploy, check on cliox.ldas.jp. Then
     update the address on docs reward-options (docs/site 0a56bff1) and push docs.
     Then the video (new chapter ch15 in ~/git/blog/cliox README table + book).
     2026-11-27 Fable review (no way found to get paid for another's job or twice).
     Fixed locally: stale quote after expiry (ClaimBox builds the tx from the fresh
     quote), contract errors shown in en/ja, pool balance checked before sending,
     decimals read from the token, exitCode must be 0 and not OOM-killed, contract
     address validated (503), longest env match wins, wording ("estimate",
     "same mdx machine, B dummy", "test token, no value"). Open:
   - Contract (needs a redeploy + moving the pool, ask first): reject a zero
     checker in configure and a zero recovered signer; guard setOwner(0).
   - Farming: reward scales with vCPU × wall time (sleep 600 on B, 2 vCPU hits
     the 500 cap); fine while only 4 allow-listed wallets can run jobs. Before
     opening: per-recipient cap/cooldown or a checker allow-list.
   - Quote endpoint: tighter id pattern, reject unless exactly one match, skip
     signing when claimed, rate-limit rule; measure Worker CPU per quote.
   - Profile line: getLogs range grows; add received/count to the contract or
     page the query; contract address is duplicated (ProfileRewards vs Worker var).
   - A fixed digest test vector shared by the TS and forge tests.
   8. Owner asked 2026-11-27: write a list of reward options with pros/cons
      (user reward [now], provider incentive (more jobs routed to green providers,
      rebate/bonus to the provider), usage-fee discount once analyses have a price,
      records only, …) and say which one is chosen now and why. Put it in the docs
      site (project/open-questions or a developers page), en/ja. Also correct the
      wallet PDF (~/git/web3/people/wallets-2026-11-27.\*): the Worker already holds
      always-on secrets that are not wallets (SESSION_SECRET, CHATBOT_API_KEY,
      CHATBOT_SIGNIN_SECRET, RESEND_API_KEY, APPLICATION_SIGNING_KEY = HMAC).
      2026-11-27 done: docs page project/reward-options (en/ja) committed on docs/site
      0a56bff1 (not pushed), linked from green-choice and open-questions. Left: the
      sidebar entry in docs-site/.vitepress/config.mts (another session has
      uncommitted edits there; add after the /project/green-choice entries:
      en 'Reward options' /project/reward-options, ja '報酬の選択肢'
      /ja/project/reward-options). Update the contract address on the page after
      the redeploy. Wallet PDF corrected (③ non-wallet keys, one page).

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
