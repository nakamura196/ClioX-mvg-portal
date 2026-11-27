# Green choice in production: design and log

Goal: on cliox.ldas.jp itself (not only under `/experiment`), let a user choose
where an analysis runs, and give feedback after the job that reflects the
choice. This is the mechanism the sustainability paper (IEEE Big Data CAS 2026)
evaluates in simulation: footprint information shown when choosing a provider.

## 2026-11-27 — where things stood, and the design

### What already existed (all under `/experiment`, illustrative)

- `/experiment/carbon-choice`: compare registered locations, record the choice
  as a non-transferable token (`CarbonChoiceRecord`, Sepolia
  `0x5919f54c…F258`), and the four fee types of `GreenFeeDemo`
  (`0xd8748Aee…DF25`, PLAY test token). Merged into `deploy/hosting`
  (PR #10, #11).
- `?demo=1` on asset pages: four illustrative providers in the compute panel
  (Fig. 1 of the paper).
- None of it is tied to a real job: the user types the run time and the
  location, and the money is PLAY.

### What production offers (measured 2026-11-27)

- `https://cliox-node.ldas.jp/api/services/computeEnvironments` returns one
  environment: "mdx (University of Tokyo, Kashiwa, Japan) mdx-kashiwa / CPU
  only", free, 2 CPU, max 900 s.
- So a user has nothing to choose between. A reward for a choice cannot exist
  until there is a second real place to run.
- A finished job from the node carries `environment`, `resources`
  (`cpu` amount), `algoStartTimestamp`, `algoStopTimestamp`, `jobIdHash`.
  Example: job `2d402f0e…`, 1 vCPU, algorithm ran 99.559 s.
- mdx-clio VM: Intel Xeon Platinum 8368, VMware, no `/sys/class/powercap`
  (RAPL is not exposed). Power cannot be measured from inside.

### Decisions (with the owner, 2026-11-27)

1. The real choice is **a second location** (a second Ocean Node in a
   low-carbon grid), because it is the paper's setting: choosing a provider.
   Rejected for now: choosing the time of day (Ocean needs the user's signature
   at start time, so a delayed start is not possible without a scheduler that
   holds signatures); choosing a lighter computation (real, but not the
   paper's setting).
2. The reward is **a record plus a running total, no money**. Analyses are
   free, so a discount would have nothing to reduce. The four fee types stay a
   prototype until analyses have a price (needs agreement with Vicki).

### Design

Feedback works per real job and does not depend on how many locations exist.
With one location it shows the job's estimate only. When a second node is
added, the comparison appears without code changes.

1. **Estimate for a real job.** Run time = `algoStopTimestamp −
algoStartTimestamp` (falls back to `dateFinished − dateCreated`). CPUs from
   `resources`. Location from `environment` → the node's environment
   description → the registry in `src/experiment/footprint/lib/computeFootprint.ts`.
   mdx power: TDP 270 W ÷ 38 cores ≈ 7.1 W per vCPU, labelled
   `portal-estimated` (an upper-leaning estimate; CPU only). Used only when the
   vCPU count is known, so planning screens keep treating mdx as not comparable.
2. **Comparison.** The same run time and CPU count, estimated for every real
   environment on the nodes the portal lists (`chains.config.js`, `isCustom`
   with `providerUri`). Not the registry's illustrative locations: those are
   not choices a user can make.
3. **Feedback in the job details** (Profile → History → compute job →
   Details): run time, energy, carbon, quality label, the comparison, the
   difference from the highest real option ("a difference between estimates,
   not a reduction").
4. **Record.** "Keep a record" writes the SHA-256 of a job receipt (includes
   `jobId`) to the existing `CarbonChoiceRecord` contract with the user's
   wallet: `record(hash, locationKey, chosenMg, highestMg, alternatives,
quality)`. No new contract.
5. **Running total** above the job list: jobs, estimated energy and carbon,
   how many ran at the lower-emission option, records kept.

### Second node: where (open, needs the owner)

- Free cloud tiers that could hold an Ocean Node (≥ 2 vCPU, several GB RAM)
  ask for a card to sign up, which the owner's rule excludes.
- Candidates without that: a machine in Vancouver (BC grid, low carbon; on a
  Mac, `powermetrics` gives measured CPU power, so the option would be
  `measured`), or a server offered by the UBC side.
- BC grid factor must be checked against a source before it enters the
  registry (the old "BC 14" value was removed in the 2026-08-12 fact check).

### Not checked yet

- Whether TDP ÷ cores is close to what a light job draws (likely high).
- mdx PUE: not entered; the estimate uses 1.0 (facility overhead not counted).
- Kashiwa is in the TEPCO area; the registry uses Japan's national substitute
  factor (429 g/kWh).

## 2026-11-27 (later) — owner's direction and free hosting

Owner: two nodes, yes. Their power and other values are **provisional**
(set by us, labelled as such). The choice between the two nodes must give the
user a **real reward** (not only a record).

Free hosting, checked with agy (Gemini; Copilot's monthly quota was used up),
not yet confirmed against the official pages by us:

- Oracle Cloud Always Free: no time limit after the trial; Ampere A1 Flex
  (arm64) is enough for an Ocean Node (agy says 2 OCPU / 12 GB now, down from
  4 / 24; **check**). Only in the home region, which cannot be changed. An
  idle instance can be reclaimed (7 days with CPU, network and memory all
  under 20 %). The owner's account exists (created 2021-11-11; after the trial
  Oracle wrote that Always Free stays usable while the account is active).
  Home region unknown (signed up from Japan, so probably Tokyo or Osaka).
- Not usable: Google e2-micro (1 GB RAM), AWS (credits for 6 months only),
  Azure (12 months), IBM (no VM in Lite).
- Digital Research Alliance of Canada, Arbutus cloud (UVic, BC): free for a
  project led by a Canadian PI (e.g. sponsored by a UBC faculty member);
  whether a public Ocean Node fits its acceptable-use policy is unconfirmed.
- arm64 pitfall: on A1, the Ocean Node image and every algorithm image
  (e.g. ocean-c2d-ndlkotenocr-lite on ghcr.io) need linux/arm64 builds.

## 2026-11-27 (evening) — second environment on the same node

- Added a second compute environment to the mdx-clio Ocean Node:
  "Provisional place B (values set by Clio-X for testing the choice; not a real
  site) / CPU only". Same VM, same limits (2 CPU / 2 GB / 900 s), free jobs 1 at
  a time (VM: 6 CPU, 8 GB, about 3 GB free).
- `/api/services/computeEnvironments` now returns two. The node hashes ids as
  `<node hash>-<env hash>`; the first environment's id did not change when the
  second was added (still `…-0x8505cbd8…`), so existing references keep working.
- Portal registry: location `provisional place b` and grid
  `provisional-place-b` = 30 gCO2e/kWh. **Provisional, not a real grid**; the
  value only has to differ from mdx (429) so the choice can be tried. Power is
  the same per-vCPU estimate as mdx, since it is the same machine. Rejected: using
  the BC value (9.9–22.8): it would read as a real place, and the note above
  says BC must be checked against a source first.
- Pitfall: matching is by substring of the description, so the second
  description must not contain "mdx" (it would resolve to Kashiwa). The test
  uses the node's exact text.
- Limit: grid factors have no quality field, so "provisional" is shown only in
  the label and source text, not as a data-quality tag.

## 2026-11-27 (evening) — should the node publish the impact values?

Owner asked whether `/api/services/computeEnvironments` should carry the
environmental values; left the decision to us.

- Ideal: yes. The place that runs the job should state its own location, grid
  factor and power, labelled `provider-reported`; the portal then shows them
  without its own registry, and any portal (not only Clio-X) can use them. This
  is the schema gap noted at the top of `computeFootprint.ts` (Ocean's
  environment has no field for where the job physically runs).
- Checked in the running node (Ocean Node image on mdx-clio,
  `dist/components/c2d/compute_engine_docker.js`): the published environment is
  built field by field (`description`, `storageExpiry`, `maxJobs`, `free`, …).
  **Unknown keys in `DOCKER_COMPUTE_ENVIRONMENTS` are dropped**, so adding a
  `footprint` object to the config does nothing.
- Decision for now: keep the portal registry. Rejected: (a) a node patch — one
  more patch to carry on every node upgrade (we already carry
  `patches/validateOrders.js`), for two environments we control anyway;
  (b) structured text inside `description` — fragile, and the description is
  shown to users as is.
- Later: when the real second node exists, propose an optional field upstream
  (Ocean Node issue), or patch both of our nodes at once. Claim candidate: the
  compute environment schema lacks a provider-declared location and energy
  profile, so carbon-aware choice needs an off-protocol registry (evidence: this
  entry and the code comment in `computeFootprint.ts`).

## 2026-11-27 (evening) — first real job on place B

- Ran with ocean-cli as the consumer wallet (0x05f1…1085), ch14's dataset
  (`did:op:be47…0e0e`) and OCR algorithm (`did:op:041e…428c`), environment
  `…-0xfa68f4b7…`. Script: `deploy/ocean-node/scripts/try-place-b-job.zsh`.
- Job `0xff1004b6…-cddbb725dc994ca251daed066c6b064d8b602b253087ff2bb91fa4882aebeb78`:
  status 70 (finished), resources cpu 1 / ram 1, algorithm ran
  1795808293.972 − 1795808196.345 = 97.627 s.
- The job record carries the environment id; with the node's environment list,
  `computeFootprint` resolves it to `provisional-place-b`: 0.00578 g CO2e
  (7.1 W × 97.627 s × 30 g/kWh). The same job priced as mdx: 0.0827 g (429 g/kWh).
  The ratio is only the provisional factor (30 / 429); it says nothing real.
- Found while answering the owner: the portal's compute form pre-selects the
  environment only when the node lists one (`FormComputeDataset.tsx`, line ~138),
  so since place B was added a user has to pick one. Not yet checked on screen.

## 2026-11-27 (night) — reward: first working version (local chain)

Owner chose the start: a reward in PLAY (the existing Sepolia test token,
`GreenFeeDemo` 0xa497…c932) paid from a sponsor pool, with the rule changeable
later. Rejected: no checker (the portal alone computing the figures; anyone
could claim for a job that never ran); a record only (owner wants a real reward).

- `GreenReward.sol`: a checker signs (jobIdHash, owner, chosen/highest env and
  their estimates in µg, expiry); anyone submits; the owner of the job gets
  (highest − chosen) × rate, capped, once per job. Rate, cap, token and checker
  are settings, so the reward rule can change without a new contract.
- The checker takes every figure from the Ocean Node, not from the person
  asking. Node 4.2.0 status needs no signature. **Pitfall:** with an unknown or
  partial jobId the node ignores the filter and returns a list of jobs, so the
  first item is the wrong job (it gave a 73.7 s mdx job instead of the 97.6 s
  place-B job). The checker now matches jobId exactly.
- Measured on anvil with the real place-B job (97.6 s, 1 vCPU): mdx 107.53 mg,
  place B 6.36 mg (dummy values), reward 101.169 PLAY to the owner, second
  claim refused.

Claim candidate: a per-job green reward can be tied to the compute node's own
job record (owner, environment, run time) instead of the user's statement,
without a new oracle; the remaining trust is in the checker's coefficients,
which are published. Evidence: this entry.

## 2026-11-27 (late) — reward received on Sepolia through the portal

- The portal now has the checker endpoint (Worker `POST /api/green-reward/quote`,
  `worker/greenReward.ts`) and a "Receive the reward" box in the compute job
  details (`src/experiment/green-reward/ClaimBox.tsx`). Local only, not deployed.
- End to end with the consumer wallet (0x05f1…C085) on the local portal, Sepolia:
  place-B job `cddbb725…`, 97.6 s, 1 vCPU. Checker estimate: mdx 107.53 mg,
  place B 6.36 mg CO2e (dummy place-B values). Contract paid 101.169 PLAY,
  tx 0x9191bb5f3fdd6de363294ccef9b85c420791d5bf992eb194f52414dd7d921639.
  Pool 1,000 → 898.831 PLAY. Reopening the job shows "already received".
- Pitfall: in this Next build, `process.env.NAME` in an API route came out
  undefined under `next dev` although the variable was in the server's
  environment (`Object.keys(process['env'])` listed it). Reading through
  `process['env']` works.
- Claim candidate: a reward for choosing the lower-carbon place can be paid from
  a real finished job without trusting the user's own figures: the job's owner,
  place, run time and vCPUs come from the Ocean Node; a signing-only checker key
  signs the estimate; the contract allows one claim per job (tx above).
