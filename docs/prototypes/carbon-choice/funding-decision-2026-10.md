# Who funds the greener-choice discount? A decision brief

For the next meeting. One decision is needed. Everything below runs on the Sepolia test network with play money (PLAY); no real money has moved.

## Where we are

- The prototype lowers the user's fee at a low-emission place. The provider always receives its full list price.
- On 5 October 2026 we checked it with a real MetaMask wallet, operated by a person. Payments, the pool, deposits and a user-created scheme all behaved as the screen predicted.
- What is missing is not technology. **It is who pays the difference in real operation.**

## The four ways, side by side

|                                    | Who bears the cost                             | Outside money needed | Strength                                                                                                                   | Weakness                                                                        |
| ---------------------------------- | ---------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Provider lowers its price       | The compute provider                           | No                   | Simplest                                                                                                                   | We cannot make providers do it; works only where power is cheap                 |
| 2. Portal lowers its fee           | Clio-X operator                                | No                   | Fully in our hands                                                                                                         | The operator gives up income; does not scale                                    |
| 3. Surcharge and discount (type 3) | High-emission users pay for low-emission users | No                   | Balances to zero; precedent: France's bonus-malus                                                                          | Users at high-emission places pay more; with an empty pool there is no discount |
| 4. Funder deposit (type 4)         | A research funder or institution               | Yes                  | Every subsidy is on a public ledger; the funder can show it was spent as intended; precedent: Japan's appliance eco-points | Needs someone to put money in                                                   |

Example from the prototype (Stockholm, OCR of about 12,000 pages): list price 11.16, discount 2.23 (type 3), subsidy 4.46 (type 4), the user pays 4.46.

## Recommendation

**Start with 4, keep 3 as a fallback.**

- 4 is the easiest to explain to a funder, and its ledger answers "where did our money go?".
- 3 needs no outside money, so it can run alongside 4 while no funder has joined.
- 1 and 2 stay open as conversations with providers and the operator, not as things we build.

## What we need from you

1. **Which option, or which combination?** (Recommended: 4, with 3 as fallback.)
2. **If 4: who could realistically deposit** (a research grant, an institutional budget, provider sponsorship), and roughly what **share and per-job cap** would be acceptable. The prototype uses 50 % and 5 PLAY.
3. **Do you want payments tied to real jobs next?** Today a payment does not start an analysis. Linking it (pay after the job starts, record the job ID on the ledger) is the next build.

## What this does not claim

- The low/high bands come from the portal's estimates, not measurements.
- A discount is not proof that emissions fell, and not a sellable credit.
- Later option: sign-in through the University's identity service (id.ldas.jp) could limit who may create or fund a scheme. Not for now.
