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
