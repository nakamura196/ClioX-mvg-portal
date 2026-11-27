# Rewarding greener choices: the options and what we chose now

This page lists the ways a greener choice could be rewarded, and says which one runs now and why.
The background (why we avoid carbon credits, the four fee types on the prototype) is in [Rewarding the greener choice](./green-choice). This page does not repeat it.

## What runs now (27 November 2026)

On 27 November 2026 the reward was tied to real jobs for the first time.
A checker reads a finished job from the Ocean Node: who owns it, where it ran, how long, and how many vCPUs.
It estimates the job's carbon at each real compute environment of that node, and signs the result.
The `GreenReward` contract on Sepolia then pays the job's owner (highest − chosen) mg × 1 PLAY per mg, at most 500 PLAY, once per job.
The money comes from a sponsor pool of test PLAY (1,000 PLAY at the start).

Measured on 27 November 2026:

- Job `cddbb725…` ran on "Provisional place B": 97.6 s, 1 vCPU.
- Checker estimates: mdx 107.53 mg, place B 6.36 mg CO2e.
- 101.169 PLAY went to the consumer wallet `0x05f1…C085`, in transaction [`0x9191bb5f…1639`](https://eth-sepolia.blockscout.com/tx/0x9191bb5f3fdd6de363294ccef9b85c420791d5bf992eb194f52414dd7d921639).
- Reopening the job shows "already received". A second claim for the same job is refused.

Please read these figures with four limits in mind.

- **Both environments are the same mdx machine.** "Place B" is a second environment on the same Ocean Node, not a real second site.
- **Place B's values are dummy.** Its grid factor (30 g/kWh) was set by us so that the choice can be tried. It is not a real grid.
- **PLAY has no value.** It is a test token on a test network.
- **The figures are estimates, not measurements.** Power is estimated per vCPU (TDP ÷ cores); nothing is metered.

The contract is being redeployed with hardening on 27 November 2026, so its address may change. See the portal for the current one (at the time of writing, `0x428745BC1aa9B5465A211742f5Dde111340CD3A0`).

Code (portal, branch `feat/green-real`): `contracts/carbon-choice/src/GreenReward.sol` (contract), `worker/greenReward.ts` (checker), `src/experiment/green-reward/ClaimBox.tsx` ("Receive the reward" box in the job details), values in `content/experiment/real-envs.json`.
The design log is `docs/notes/green-choice-in-production.md` on the same branch.

## The options

| Option                                            | Who pays                                                                | What the user or provider gets                                                      | What must be true                                         | Main risk                                                                                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **(a) Reward the user from a sponsor pool** (now) | A sponsor fills a pool in advance (today: the operator, with test PLAY) | The user who chose the lower-carbon place receives tokens per job                   | Someone funds the pool. The checker's figures are trusted | The pool runs dry. Users can game it (see "Known limits")                                                                                                               |
| **(b) Reward the provider of greener compute**    | The operator, or users through routing                                  | The provider gets more jobs routed to it, or a rebate or bonus per job chosen there | More than one real provider. A way to route or pay them   | Hard to give a provider "more jobs" while the user chooses. A bonus needs a funder too. Type 1 on the prototype was the reverse: the provider gave up part of its price |
| **(c) Discount the usage fee**                    | Provider, portal, or a subsidy (types 2–4 on the prototype)             | The user pays less at the greener place                                             | Analyses must have a price                                | Today's analyses are free, so there is nothing to discount                                                                                                              |
| **(d) Feebate: surcharge high, discount low**     | Users of high-emission places                                           | Users of low-emission places get a discount                                         | Enough people still choose high-emission places           | Revenue-neutral only on paper. The pool ran dry on the prototype when most chose low (type 3, payment #14)                                                              |
| **(e) Record only**                               | Nobody                                                                  | A record of the choice ([prototype (i)](./prototypes/carbon-choice))                | Nothing more                                              | No incentive. People may not bother                                                                                                                                     |
| **(f) Carbon credits**                            | Buyers of credits                                                       | The user (or Clio-X) sells or retires a credit                                      | Measured, verified reductions, certified by a registry    | Not possible with estimates (see below)                                                                                                                                 |

Why estimates are not enough for (f).
A credit promises "X tonnes of CO2 were reduced", and buyers use it to cancel their own emissions.
So the number must be measured and verified by a third party, against a baseline the registry accepts.
Our figures are estimates from coefficients, the "highest" option is a job that never ran, and no one verifies them.
Vicki mentioned carbon credits as future work. They would need metered power at real sites and certification first.

## What gives a reward value

PLAY is a toy. For a reward to be worth something, there are two paths.

1. **An existing stablecoin** (yen or dollar, such as JPYC or USDC), paid out by an operator from its own funds.
2. **A credit usable only as a discount on the service.** It has value only inside Clio-X.

Issuing an own currency was ruled out on 27 November 2026.

Each path may fall under a different legal category (for example, prepaid payment instruments or crypto-assets). We have not checked this. It must be checked with a lawyer before any real use. This page draws no legal conclusion.

**Who pays the gas.** Today the person who receives the reward sends the claim, so they pay the fee in Sepolia ETH. A real service would need to cover it, for example by sending the claim on the user's behalf.

## What we chose now and why

We chose (a), a user reward from a sponsor pool, for four reasons.

- **It works with today's free jobs.** There is no price to discount, so (c) and (d) have nothing to act on.
- **It needs no change to Ocean.** The checker only reads the node's existing job record, and the contract stands alone.
- **The rule stays changeable.** The rate, the cap, the token and the checker can be changed by the contract's owner without a new contract.
- **It shows the whole path on real jobs:** choose, run, check, pay, on the chain.

Known limits from the security review (27 November 2026):

- **The reward grows with vCPU × wall time.** A long job that does nothing earns more. For example, a job that sleeps for 600 s on place B with 2 vCPUs reaches the 500 PLAY cap. This is acceptable while only 4 allow-listed wallets can run jobs. Before opening it to others, it needs a cap per recipient or an allow-list.
- **The quote endpoint has no rate limit yet.**
- The review found no way to be paid for another person's job, or twice for the same job.

## Decisions for the project

For Vicki and the group:

- **Who funds the reward** in real use: the operator, a research grant, providers, or a mix.
- **Which option to try next**, for example (c) once analyses have a price, or (b) once there is a second real provider.
- **Whether providers should get a share** of the reward, and how much.
- **Who operates a real-money version** (open question, not a conclusion). A university researcher alone probably cannot easily hold and pay out JPYC: university accounting rules, the recipients' tax, and possibly a licence if the operator holds users' funds (to be checked with a lawyer). A real service may need an operating organisation (for example a company) or a partner.
