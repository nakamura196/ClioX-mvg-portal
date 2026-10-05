# New here? What the environmental prototypes do

This page is for readers with no background.
You do not need to know what a blockchain or a wallet is.

## In one sentence

**We are trying out a way to make it pay off to run an analysis in a place with lower emissions.**

It started at the meeting on 30 September 2026.
Vicki said she wanted to widen users' choices and make the greener choice easier.
We built two prototypes in response.

- Prototype 1: record the place you chose, in a form anyone can check later.
- Prototype 2: make the fee lower for a low-emission place.

Both run on a test network (Sepolia) with play money (PLAY). **No real money moves at all.**

## Five words first

| Word                  | What it means here                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Wallet (MetaMask)     | A browser add-on, like a purse and a signature stamp in one. It holds no money for you here. You use it to sign "I approve this"       |
| Sepolia               | A practice area of the blockchain. It has no monetary value                                                                            |
| PLAY                  | Play money made for this prototype. A button gives you up to 1,000                                                                     |
| Ledger                | A record of who paid how much and when. Once written it cannot be erased, and anyone can read it                                       |
| Fingerprint (SHA-256) | A short string computed from a file. Change one character and the string changes. It is used to check that a file has not been altered |

## Numbers and words on the screen

### gCO2e

Grams of CO2 equivalent. The "e" stands for equivalent.
Gases other than CO2, such as methane, are converted to CO2 by their warming effect and added up.
On this screen it is an estimate of the emissions from the electricity used to run a computer at that place for one hour.
14.0 gCO2e is 14 grams; 2.84 kgCO2e is 2.84 kilograms.

### "Low", "medium", "high"

A label that sorts each place's emissions (g per hour) into three bands.
By default, 5 or less is "low", 20 or more is "high", and anything between is "medium".
You can change the cut-offs in box 3. They are decided from the portal's estimate, not a measurement.

### List price, surcharge, discount, subsidy, you pay

| Word       | Meaning                                                     | Whose money                                                                 |
| ---------- | ----------------------------------------------------------- | --------------------------------------------------------------------------- |
| List price | The fee the provider set. The provider always receives this | —                                                                           |
| Surcharge  | Added to the list price at a "high" place                   | Paid by the user and kept in the pool                                       |
| Discount   | Taken off the list price at a "low" place                   | Comes from the pool (type 3)                                                |
| Subsidy    | A further reduction at a "low" place                        | Comes from the funder's deposit (type 4)                                    |
| You pay    | What the user actually pays                                 | List price − discount − subsidy (at a "high" place, list price + surcharge) |

Example: AWS Stockholm is list price 11.16 − discount 2.23 − subsidy 4.46 = you pay 4.46 PLAY.

### Pool and deposit balance

Both are the saved-up money that pays for discounts and subsidies.

- **Pool (type 3):** the surcharges collected at "high" places, kept together. No outside money goes in. When it is empty, there is no discount.
- **Deposit balance (type 4):** what is left of the money a funder deposited. It goes down each time a subsidy is paid.

Box 3 shows the current amounts as "Type 3 pool" and "Type 4 deposit balance".
Watch how they fall after a payment to see where the money goes.

## The screen, section by section

Open https://cliox.ldas.jp/carbon-choice. There are five boxes, top to bottom.

### Box 1 "The work"

You enter **what the analysis is for and how big it is**.
Example: OCR of about 12,000 digitised pages, 40 jobs, 30 minutes each.

These numbers are the **input** to the emissions estimate.
Real machines differ in speed, so the page assumes the same running time everywhere.

### Box 2 "Where to run it"

The places where the analysis could run are listed side by side.
Each shows an estimate of CO2 per hour, a cost and a bar.

- Example: AWS Stockholm (low emissions), AWS Tokyo (high).
- A place whose power use is not measured is listed apart as "cannot be compared". It is not ranked and not counted as zero.
- How far to trust each number is shown (measured, provider-reported, portal-estimated).

**The place you choose here sets the fee in the next box and the content of the record.**

Note: this is the difference between two estimates. It is not a reduction measured against what would otherwise have happened.

### Box 3 "How the fee is set (prototype)" ← prototype 2

Here you try **how the fee changes with a place's emissions**.
This is the centre of the new work.

- **Scheme**: pick a set of fee rules. #1 is the Clio-X demo. You can also create your own.
- **Type 3, surcharge and discount**: a high-emission place pays a surcharge, which goes into a pool. A low-emission place gets a discount paid from that pool. No outside money; with an empty pool there is no discount.
- **Type 4, sponsor deposit**: a funder, such as a research council, deposits money. When you choose a low-emission place, part of the fee is paid from it.
- **"Get play money"**: gives you PLAY.
- **"Pay for …"**: paying writes the amount and its breakdown into the ledger.
- **"Deposit"**: really puts money into the sponsor deposit of type 4.
- **Ledger**: one row is added per payment, showing surcharge, discount and subsidy.

**The provider always receives its full list price.** Only the user's share changes.

### Box 4 "Keep a record" ← prototype 1

Here you **keep what you chose in a form that can be checked later**.

1. "Download the record" saves a file (JSON) of your choice.
2. Its fingerprint is written to Sepolia ("Record this choice"). The file itself stays with you.
3. What is written becomes a token that cannot be handed to anyone else.

Later, the fingerprint shows whether the file was changed.

### Box 5 "Records"

The records (tokens) held by your wallet.
"Check a record file" lets you pick a file from your computer and see whether its fingerprint matches.

## How the two prototypes relate

|                                | What it does                           | Who gains                               |
| ------------------------------ | -------------------------------------- | --------------------------------------- |
| Prototype 1 (boxes 1, 2, 4, 5) | Records the place chosen               | Nobody. A record is just kept           |
| Prototype 2 (box 3)            | Lowers the fee in a low-emission place | The user who picks a low-emission place |

Vicki's aim was that the greener choice should pay off.
Prototype 1 only records, so nothing is gained. That is why prototype 2 was added.
A payment also stores the record's fingerprint in the ledger, so the two are linked.

## What this prototype does not do

- **It is not proof that emissions fell.** Emissions are the portal's estimate, not a measurement.
- **It is not a sellable credit.** Turning reductions into something sold runs into trust in measurement and certification (the Toucan / Verra case of 2023). So we reward through a price difference instead.
- **The link to a real job is only a record.** In the Compute screen, a job's Details window has a link to pay the green fee for that job. The payment stores a fingerprint of the job ID in the ledger, and the "Job" column shows which payment belongs to which job. But paying does not start or change the analysis. The place you choose is an estimate; the real job runs on the single Clio-X node.

## Still undecided

**Who puts the money in.** There are four ways.

1. The place's provider lowers its price.
2. The portal lowers its fee.
3. Type 3: surcharges and discounts balance out to zero.
4. Type 4: a funder deposits.

See [Rewarding the greener choice](./green-choice) for the detail.
