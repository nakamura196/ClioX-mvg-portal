# Open questions

Things we would like to decide with the Clio-X team.

## Direction

1. **Which of the prototypes are worth continuing?** See [Prototypes](./prototypes/). Each is small and on its own branch.
2. **Is a trial outside Pontus-X welcome?** The Sepolia trial lets people try Clio-X without membership. It is public since 26 September 2026 and uses test currency only. Pontus-X remains the production network. If the Clio-X team prefers otherwise, the trial can be closed or restricted.
3. **Who should review the texts for archivists?** The glossary (13 terms), the 20 answers and the video captions are drafts. They need a check by archivists, ideally in both English and Japanese.

## Custody and permanence

From [When the publishing service closes](/archivists/when-a-node-closes):

4. Should member institutions be asked to publish through a name they control and to keep their node key?
5. Should Clio-X provide a way to move records between nodes?
6. Can the _custodian_ of a record on Clio-X be the institution itself, rather than the node it happened to use?
7. Should descriptions be published unsealed, so that the catalogue survives a closed node?

## Access

8. **Who may run analyses?** Ocean Node offers three official ways: an address list (used on the trial now), an on-chain access list shared by several nodes, or a policy server checking credentials (the Pontus-X model). An on-chain list for participating institutions looks like a good fit.

9. **Gaia-X.** The portal can draft Gaia-X Service Credentials, but only on Pontus-X, and the template follows an old Trust Framework (22.10). Do Clio-X institutions want to take part in Gaia-X? See [The Gaia-X Service Credential button](/developers/gaia-x-credential).

## Vocabulary

10. InterPARES Trust AI has “definition not yet developed” for _wallet_, _transaction_ and _smart contract_. Could the project contribute definitions?
11. The Japanese names of the ISAD(G) elements in the finding-aid prototype are our own rendering. They should be checked against the published Japanese translation.

## Visualizations and Chatbot

12. **Which chat service should the Chatbot use?** Upstream's public service (`ciferresearch/Cliox-rag-chatbot-backend`, last updated 2025-07-17) no longer matches the portal and has no licence; the service upstream runs today is not published. The trial uses a small service we wrote. Could upstream publish theirs, or should ours be offered upstream? Also: preparing the Chatbot sends passages of the text out of the institution, so the project needs a rule on which records it may be used for. And is a local model on the node's own VM acceptable for the trial (it answers in 15–26 s), or should answers come from an external model service? See [Visualizations and Chatbot](/developers/usecases).

## Environmental impact as tokens

13. **Could emissions be turned into tokens that users receive, or can sell?** (Raised at the meeting of 30 September 2026.) Technically, yes: on a test network, minting and distributing a token can be prototyped in a few days. Making it a _sellable carbon credit_ is a different matter, for three reasons.

    - **Nobody verifies the number.** Power readings come from the node operator's own machine. Writing them on chain makes them tamper-evident, not true — an attributable claim, not an established fact.
    - **A "reduction" needs a baseline.** "We ran in Stockholm instead of Calgary, so we saved X" compares against emissions that never happened. In 2023 most credits of this kind were found to have no real effect; the main tokenized-credit venture (Toucan) stopped its core business and the registry Verra banned tokenizing its credits.
    - **Selling needs certification and legal review.** Credits not certified by a registry (Verra, Gold Standard, …) are not accepted in the market, and a tradable token may count as a financial product in some jurisdictions.

    To widen users' choices without those problems, we propose three steps:

    - **(a) Let users choose a low-carbon location** by showing emissions per location before a job runs (an extension of the [Carbon report](./prototypes/carbon-report)).
    - **(b) Record the choice** with a non-transferable token — a badge the holder cannot sell — stating that the job ran at a low-carbon location. It is labelled as a claim, not a verified fact.
    - **(c) Link to retiring certified credits.** Instead of issuing credits ourselves, users may retire credits already certified by a registry and attach the retirement proof to the job's record. This is shown separately from the emissions figure (ISO/IEC 21031, SCI) and never subtracted from it.

    Steps (a) and (b) are now [prototype (i)](./prototypes/carbon-choice) (30 September 2026). Still for the Clio-X team to decide: whether (c) is wanted, and how essential "sellable" is.

## Identity

14. **Does Clio-X need to build its own identity system?** (Raised at the meeting of 30 September 2026.) We think not. Existing systems can be used in two layers. Findings from public sources on 30 September 2026; points not confirmed are marked.

    - **Institutions: Gaia-X credentials.** On Pontus-X, an institution registers through deltaDAO's Fast Track Onboarding and receives Gaia-X participant credentials (legal person, registration number, acceptance of terms). The data sheet says joining is free. Not confirmed: whether Japanese or Canadian university registration numbers pass the check. In Japan, NTT DATA runs a test Gaia-X clearing house (GXDCH).
    - **People: academic identity federations.** GakuNin in Japan and the Canadian Access Federation (CANARIE) in Canada, both part of eduGAIN. Staff at the University of Tokyo or UBC can show their affiliation with their normal university login.
    - **Clio-X only needs the bridge.** Ocean Nodes support on-chain access lists of allowed addresses and an external "policy server". A small service that checks a university login and then adds the person's address to the list would connect the two. Direct use of W3C Verifiable Credentials is still listed as future work in Ocean.
    - Japan's GBizID and My Number Card are for government procedures and personal ID, and do not seem to fit institutional membership (our assumption).

    For the Clio-X team to decide: (1) whether member institutions should hold Gaia-X credentials, and (2) whether to use eduGAIN (GakuNin, CAF) to confirm individuals.
