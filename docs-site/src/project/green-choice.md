# Rewarding the greener choice

At the meeting on 30 September 2026, Vicki asked for this: when people run an analysis, those who choose a place with lower emissions should benefit.
This page sets out what we learned, what has been built, what comes next, and what we need the Clio-X team to decide.

## What exists now: a prototype that records the choice

[Prototype (i)](./prototypes/carbon-choice) runs on cliox.ldas.jp at [/carbon-choice](https://cliox.ldas.jp/carbon-choice).

An analysis can run in any of several data centres.
Electricity is produced differently in each place, so the same job emits different amounts of CO2.
In the default example (text recognition on about 12,000 images), Stockholm, with mostly hydro power, comes to about 14 g; Calgary, with mostly fossil power, about 2.8 kg.

The page does three things.

1. **Compare.** It lists the estimate for the same job in each place, lowest first.
2. **Choose.** The person picks one place.
3. **Record.** It records when, who, which candidates, and which place was chosen.

The record is kept in two parts.
The record itself (all candidates and figures) is a file the person keeps.
Only the file's "fingerprint" goes on the public ledger (the blockchain). The fingerprint is a string computed from the contents; change one character and it is completely different.
Think of it as a registry stamping the receipt of an original document.
Anyone can later check that the file has not changed since it was recorded.

On 1 October 2026 the whole path, including signing from the page, was run end to end (token #2).
A copy of the file with one figure changed was reported as "does not match".
The signing, however, was done by a script driving the trial wallet.
Signing by a person with a real MetaMask is still untested.

**This prototype gives no benefit.** It only keeps a record.
That is the result of avoiding a sellable credit. The next section explains why.

## Buying and selling is not the problem

Clio-X already buys and sells with tokens.
The right to use a dataset or an analysis is obtained by paying in tokens.
On the trial environment, on 30 September 2026, we sold one record for a test currency and bought it with another wallet.

The difference is **what the token promises**.

- **A right to use a dataset** promises only "you may use this data".
  If the data arrives, the promise was kept. It is ordinary commerce.
- **A carbon credit** promises "X tonnes of CO2 were reduced".
  Buyers use it to cancel out their own emissions.
  So third parties need to be able to trust the number.

Every difficulty with carbon credits comes from that promise.

- The prototype's figures are estimates, not measurements of this job, and nobody verifies them.
- A "reduction" is a difference from what would otherwise have been emitted. How that baseline is set can make the number as large as one likes.
  In 2023 many such credits were found to have no substance, and Toucan, an exchange for tokenised credits, stopped its main business.
- Credits not certified by a registry (Verra, Gold Standard and others) are not accepted on the market.
  In some countries a sellable token may also be treated as a financial product.

## How to give the benefit: price the difference

So instead of having a token claim a reduction, we **make the price itself differ**.
Running an analysis in a lower-emission place costs less.

- No new token or points are needed. Each compute environment already has its own price.
- The benefit comes at the moment of payment, which is easy to understand.
- The only claim is "this place is cheaper because its estimated emissions are lower". It is not a guarantee of any reduction.

With the current figures, Stockholm, the lowest-emission option, is also the cheapest at $11.16 (Tokyo is $23.34).
Sometimes the greener place is cheaper anyway.

## Who pays

There are four ways to fund the discount. Each has real-world precedents.

1. **The compute provider lowers its own price.** No outside money. Works where electricity is cheap.
2. **The portal (Clio-X) lowers its own fee.** The operator gives up that income.
3. **Charge more for high-emission places and use it to discount low-emission ones.** No outside money; the total balances to zero.
   France's car "bonus-malus" (a charge on high-emission cars that pays for subsidies on low-emission ones) works this way.
4. **Bring in outside funds such as grants.** A research funder or similar deposits money in advance.
   When someone chooses a low-emission place, part of the price is paid from it.
   For example, if the provider asks 100, the person pays 50 and the subsidy 50.
   Japan's "eco-point" programme for home appliances (2009–2011, government-funded points for buying energy-efficient appliances) worked this way.

The fourth suits a blockchain well.
Every payment from the deposit (when, for whom, for which analysis) stays on the ledger, and anyone can check it.
The funder can show afterwards that the subsidy was spent as intended.

## The prototype: how the fee is set (1 October 2026)

Types 3 and 4 now run on the Sepolia test network with play money (PLAY).
See "3. How the fee is set (prototype)" on [/carbon-choice](https://cliox.ldas.jp/carbon-choice).
On the "compare and choose" screen, each place shows its list price and what the user actually pays.

- **3 (surcharge and discount)**: high-emission places (by default 20 g per hour or more: Tokyo) pay a 20 % surcharge into a pool.
  Low-emission places (5 g or less: Stockholm and Montreal) get a 20 % discount from that pool.
  No outside money. When the pool is short, the discount is only what it holds, and the screen says so.
- **4 (deposited subsidy)**: anyone can deposit money. Choosing a low-emission place pays half the fee from the deposit, up to 5 PLAY per job.
- In every case the provider receives its full list price. Only the user's share changes (type 1, added in November, is the one exception: the provider gives up part of it).
- The shares, the cap and the band limits can be changed on screen; every amount updates at once.
  A visitor can also open their own scheme with those settings.
- Every payment and deposit stays on the ledger. The screen lists them, each with a link to its transaction.

Example (OCR of about 12,000 pages, Stockholm): list price 11.16, discount 2.23, subsidy 4.46, so the user paid 4.46.
The provider received 11.16.
This payment was made from the page on 1 October 2026.
As before, it was signed by a trial wallet driven by a script.

Details (contract address, what was checked) are in [the notes for prototype (i)](./prototypes/carbon-choice).

## Comparing all four types (6 November 2026)

Types 1 and 2 now run too, so all four can be switched and compared.
The aim is that you can pay under each type and see the difference before we discuss.
This is live on [/carbon-choice](https://cliox.ldas.jp/carbon-choice).

- **1 (provider rebate)**: the computing provider gives up part of its list price, only for jobs in low-emission places.
  Only the provider (or the operator) can set the share. A scheme only chooses whether to use it.
  No one plays the provider in the prototype, so the operator set a provisional 10 % for every place.
- **2 (portal fee)**: the portal adds a fee to every job (10 % by default) and waives it in low-emission places.
  Low-emission places do not become cheaper than the list price. The other places just become more expensive.
- The "Options" bar on the page selects one type, "3 + 4", or "all four".
  The table below it shows what the user pays at the chosen place and at Tokyo, the highest-emission place.

We set up one scheme per combination on the test network and paid under each (a 20-hour job, in PLAY; list price 23.34 in Tokyo, 11.16 in Stockholm).

| Option   | Tokyo pays | Stockholm pays | Who covers the difference                 |
| -------- | ---------- | -------------- | ----------------------------------------- |
| 1 only   | 23.34      | 10.04          | Provider forgoes 1.12                     |
| 2 only   | 25.68      | 11.16          | 2.33 fee in Tokyo; waived in Stockholm    |
| 3 only   | 28.01      | 8.93           | 2.23 discount from Tokyo's 4.67 surcharge |
| 4 only   | 23.34      | 6.16           | 5.00 from the deposit (cap)               |
| All four | 30.35      | 3.91           | Provider 1.12, pool 2.23, deposit 3.91    |

### Payments made by a person with MetaMask

On the same day, a person signed and paid with a real MetaMask wallet.
Earlier payments were made by a trial wallet driven by a script, so this is the first time it was done by hand.
All three are in Stockholm (list price 11.16).

- **Payment #12 (3 + 4)**: discount 2.23, subsidy 4.46, so the user paid 4.46. The same as the October example above.
- **Payment #13 (all four)**: provider 1.12, pool 2.23, deposit 3.91, so the user paid 3.91, as in the table. The 1.12 fee was charged and then fully waived.
- **Payment #14 (all four, the next payment)**: the user paid 4.92.
  Only 0.20 was left in the type 3 pool, so the discount was cut to that.

### What we learned

- **Type 3 stops discounting when the pool runs out.** The pool is filled by surcharges on people who pay in high-emission places.
  If almost everyone chooses low-emission places, it cannot last. This actually happened with #14.
  The "Will the type 3 pool last? (estimate)" section on the page calculates how lopsided use can be before it runs out (portal commit `0498f6f6`, PR #11). For a 20-hour job, the pool shrinks unless at least 32.4 % of jobs run in Tokyo: one Tokyo surcharge (4.67) covers only about two Stockholm discounts (2.23 each).
- **Type 2 alone leaves low-emission places at the list price.** They do not get cheaper; the others get more expensive (Stockholm stays at 11.16, Tokyo 25.68).
- **Stacking all four widens the gap a lot.** Stockholm pays 3.91 and Tokyo 30.35 (list prices 11.16 and 23.34).
- The 10 % for type 1 is a provisional value set by the operator, not one offered by a real provider.

## What we need you to decide

- **In real operation, who pays?** Which of the four, or which combination. If type 3 is used, what happens when the pool runs out?
- **If type 1 is used, can we ask providers for a rebate?** The provider sets the share.
- **If option 4 is used, what funds are expected?** Research grants, institutional budgets, provider sponsorship, and the subsidy share and cap.
- **Is (c) in [open question](./open-questions) 13** (linking to the retirement of certified credits) also needed?
