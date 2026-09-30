# Visualizations and Chatbot on Sepolia

The portal has two "use case" pages that turn the result of a compute job into something to look at:

- **Visualizations** (`/usecases/visualizations`): word cloud, sentiment by day, documents per day and a corpus summary.
- **Chatbot** (`/usecases/chatbot`): questions answered from passages of the documents.

Upstream, both pages only know assets on Pontus-X.
This page records what was needed to make them work on the Sepolia trial, and how to set them up on another host.
Portal changes are on branch `feat/usecases-sepolia` (merged into `deploy/hosting`); commits are given below.

## How the two pages work

Neither page runs anything by itself. Both follow the same pattern:

1. You run a compute job with a **particular algorithm** on a **particular dataset**.
2. The page lists your jobs whose algorithm DID and dataset DID are in a list written into the portal code, for the network you are on.
3. You press **Add** (or the chatbot's equivalent) on a finished job. The page downloads the job's results in the browser, signed by your wallet, and reads them **by file name**.

| Page           | Looks for                                                                                                     | DID lists                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Visualizations | `wordcloud*`, `sentiment*`, `date_distribution*`, `email_distribution*`, `document_summary*` (JSON or CSV)    | `src/components/TextAnalysis/_constants.ts`                                     |
| Chatbot        | a file whose name contains `final_output` (JSON: a list of `{id, content, metadata}`), sent to a chat service | `src/components/ChatbotUnified/_constants.ts` → one `_constants.ts` per project |

The chatbot also needs a separate **chat service**. The portal's server-side routes `/api/chatbot/*` forward to it at `CHATBOT_API_URL`.

## Why they did not work on Sepolia

Checked by reading the code on `deploy/hosting` (`a3e93a55`) and the Ocean Node 4.2.0 code on the trial VM, 2026-09-27.

1. **The DID lists only had Pontus-X (chain 32456).** On Sepolia (11155111) no job could match, so the pages stayed empty.
2. **Ocean Node 4.x returns one `outputs.tar`, not separate files.** The node saves the job's `/data/outputs` folder with Docker's `getArchive` as `outputs.tar` (`dist/components/c2d/compute_engine_docker.js`); a job's results are `image.log`, `configuration.log`, `algorithm.log`, `outputs.tar`. The pages look for file names such as `wordcloud.json`, so they found nothing. This affects any portal on Ocean Node 4.x, not only Sepolia.
3. **There was no chat service**, and upstream's public one no longer fits the portal. [ciferresearch/Cliox-rag-chatbot-backend](https://github.com/ciferresearch/Cliox-rag-chatbot-backend) (last commit 2025-07-17) answers `/chat` with one JSON body, while the page reads a stream of server-sent events (`src/@utils/chatbot/index.ts`, `streamChat`); it also has no `DELETE /knowledge/session`. The repository has no licence file. The service upstream runs today is not public.

## What was added

| What                                                                                                                                      | Where                                                                                                                    | Commit                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Open `outputs.tar` in the browser, pass its files on by name                                                                              | `src/@utils/computeResultFiles.ts`, both `JobList.tsx`                                                                   | `39bd5c29`             |
| Send a shared key to the chat service (only if `CHATBOT_API_KEY` is set)                                                                  | `src/@utils/chatbot/upstreamAuth.ts`, `src/pages/api/chatbot/*.ts`                                                       | `f4914b6f`             |
| Text-analysis and knowledge-passage algorithms, Federalist Papers sample                                                                  | `deploy/trial/algorithm/`, `deploy/trial/sample/`                                                                        | `dcf93888`             |
| A small chat service + Ollama, started only when a key is set                                                                             | `deploy/ocean-node/chatbot/server.py`, `docker-compose.yml` (profile `chatbot`)                                          | `412841d5`             |
| Publish script for the three assets and two test jobs                                                                                     | `deploy/trial/usecases.zsh`, `deploy/trial/metadata/*`                                                                   | `7808ea0c`             |
| Sepolia DIDs; a "Trial samples (Sepolia)" chatbot project, listed first on Sepolia                                                        | `src/components/TextAnalysis/_constants.ts`, `src/components/ChatbotTrial/`, `ChatbotUnified/`                           | `fb777a6d`             |
| List free jobs from our own node; remember the dataset of a job; sign result downloads the Ocean Node way; refetch when a wallet connects | `src/@utils/compute.ts`, `src/@utils/jobAlgorithmMemory.ts`, `src/@utils/computeResultFiles.ts`, the three `JobList.tsx` | `a64cb256`             |
| Read the chat key through `serverRuntimeConfig`; chat service reads chunked bodies                                                        | `next.config.js`, `upstreamAuth.ts`, `server.py`                                                                         | `2357e5ee`, `d1fa37fb` |
| Let Vercel through Cloudflare's bot protection for the chat hostname only                                                                 | `deploy/ocean-node/scripts/cloudflare-allow-chatbot.zsh`                                                                 | `02a74775`             |

### The algorithms

Both are single Python files using only the standard library, run in `python:3.12-slim` (pinned by digest), with network access off.
They read plain text, TEI/XML (tags removed) and `.tar.gz` / `.zip` archives of those.

- `text_analysis.py` writes the five files the Visualizations page reads.
  A document placed on the timeline needs a header line such as `Date: 1787-11-22` (or an e-mail style date) before a blank line; undated documents still count in the word cloud and summary.
  Sentiment is counted per sentence with a short built-in word list. **It demonstrates the chart; it is not a validated sentiment model.**
  For Japanese, runs of kanji or katakana count as words; the readability index and words per sentence are meaningless there.
- `chatbot_knowledge.py` cuts each document into passages of about 250 words (400 characters for Japanese) and writes `final_output.json`.
  **Unlike the other samples, this returns the text itself**, in pieces. Use it only on material that may be quoted.

Measured locally in the same container with `--network none` on the Federalist sample (85 documents): 185,897 words, 76 publication days, top words _states_ 845, _government_ 824; 930 passages (1.5 MB of JSON).
On the Declaration sample the word counts match the earlier `word_frequency.py` job (_people_ 10, _laws_ 9, _states_ 8).

### The sample: The Federalist Papers

85 essays, one text file each, with `Title`, `Author`, `Published` and `Date` headers, built from Project Gutenberg eBook #1404 by `deploy/trial/sample/build_federalist.py` (reproducible: the same source gives the same archive, sha256 `5bf1b484…`).
It was chosen because it is public domain, English, and **dated** (27 Oct 1787 – 28 May 1788), so every chart has something to show.
The build script checks each date against the weekday printed with it; this found one error in the Gutenberg text (No. 26, "Saturday, December 22, **1788**" — 22 Dec 1788 was a Monday; it appeared on 22 Dec 1787).

### The chat service

`deploy/ocean-node/chatbot/server.py` implements the six calls the portal makes, and nothing else:

| Call                                       | Does                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `GET /api/health`                          | `{status, ollama_connected, model}` (the only call without the key)  |
| `POST /api/v1/session/knowledge/upload`    | stores passages for the session, in memory                           |
| `GET /api/v1/session/knowledge/status`     | number of passages                                                   |
| `DELETE /api/v1/session/knowledge/session` | forgets the session                                                  |
| `POST /api/v1/session/chat`                | answer as server-sent events (`status`, `chunk`, `complete`) or JSON |

It finds the 4 best passages with BM25 (words; Japanese by character pairs) and asks a local model through Ollama to answer from them, naming the passage.
Model: `qwen2.5:1.5b` (about 1 GB), chosen over upstream's `llama3.2:1b` for its Japanese.
Sessions are dropped after 2 hours without use; nothing is written to disk.
Every call except health needs the header `X-Chatbot-Key`; the key lives in 1Password, the VM's `.env` and the portal's Vercel settings.

Measured on a Mac (CPU, Docker) with the 930 Federalist passages: _"What does Madison say about factions?"_ → the definition from No. 10, sources No. 10 ×3 and No. 24, 5.8 s; _"Why is a standing army dangerous?"_ → sources No. 26, 29, 24, 2.9 s.
A Japanese question over English passages finds nothing, because search is by words; the service then says so instead of calling the model.
Measured on the trial VM through the live portal (`https://cliox.ldas.jp/api/chatbot/*`, 2026-09-27), after uploading the same 930 passages:

| Question                                             | Answer (abridged)                                                       | Sources            | Time                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------- | ------------------ | ----------------------------------- |
| What does Madison say about factions?                | "a number of citizens united … adverse to the rights of other citizens" | No. 10 ×3, No. 24  | 25.6 s (includes loading the model) |
| How long do senators serve, according to the papers? | "The papers do not say."                                                | No. 80, 81, 18, 85 | 14.9 s                              |
| 派閥について何と書いてありますか                     | fixed reply: no matching words                                          | none               | 0.01 s                              |

The second answer shows the limit of word search: the passages about the Senate (No. 62–63) use "senate" and "six years", not "senators serve", so they were not retrieved. The model then said so instead of inventing an answer, as the prompt asks.

### Comparison: answering with Claude

The service can write its answers with Claude (Anthropic API, `claude-opus-5-5`, effort `low`) instead of the local model. Set `CHATBOT_BACKEND=anthropic` and `ANTHROPIC_API_KEY` in the VM's `.env` and run `deploy.zsh`. The key is in 1Password as "Clio-X chatbot Anthropic API key".
The passage search is unchanged, so **both models receive the same passages**. Only the reading and writing differs.

Same 930 passages, same 8 questions, on a Mac (2026-09-30):

| Question                                                         | qwen2.5:1.5b                                                                         | Claude                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| What does Madison say about factions?                            | Quotes the definition in one sentence                                                | Definition, the two cures (remove causes / control effects), why majority factions are the danger |
| How long do senators serve, according to the papers?             | "The papers do not say."                                                             | "The documents do not say." Also notes No. 18's senate is an ancient league, not the U.S. Senate  |
| Why is a standing army dangerous?                                | "Dangerous to liberty", one sentence                                                 | Gives the reasons in the passages (No. 26's example from 1688) and says they are incomplete       |
| Why does Hamilton call the judiciary the least dangerous branch? | Correct, one sentence (no sword, no purse)                                           | Same points, in four parts                                                                        |
| How do No. 10 and No. 51 differ in how they control factions?    | **Wrong**: presents "moral and religious motives", which No. 10 rejects, as a remedy | Correct contrast; notes the No. 51 passages given do not mention factions directly                |
| What did Lincoln say at Gettysburg?                              | "The documents provided do not say."                                                 | Same, and notes the papers date from 1787, the address from 1863                                  |
| 派閥について何と書いてありますか (Japanese)                      | Fixed reply (no matching words)                                                      | Same: the search finds nothing, so no model is called                                             |
| What does Federalist No. 51 say about ambition?                  | "Ambition must be made to counteract ambition."                                      | That sentence plus the argument around it ("If men were angels…")                                 |

Findings:

- **Claude's answers were fuller and had no errors.** qwen's were short, and on the comparison question it stated the opposite of the text.
- **Neither invented anything.** Both said when the passages did not answer the question.
- **The search limits stay.** The Senate term and the Japanese question fail with either model; the fix belongs in the search.
- **Time.** Claude took 2.7–15.8 s per question (median 6.9 s). It does not use the VM's CPU, so it should be similar on the VM. qwen took under 1 s on the Mac but 15–26 s on the VM (table above).
- **Cost.** Claude used about 1,600 input and 330 output tokens per question: **about 1.3 US cents** (at $4 / $20 per million tokens). qwen is free.

Anyone on the public site can ask questions, so with Claude the cost grows with use. At most 2 answers run at once (`MAX_PARALLEL`), but there is no daily cap. The next section limits the number of questions; also set a spending limit for this key in the Anthropic Console.

### Sign-in and question limits (optional)

Claude costs money per question, so who can ask and how many times can be limited. **Each of these works only when set.** Without them, anyone can ask, as upstream.

- **Portal (Vercel): `CHATBOT_REQUIRE_SIGNIN=true`.** When a user who connected their wallet in the header sends their first question, the wallet asks them to sign a short message (Sign-In with Ethereum layout; no transaction, no fee). There is no separate sign-in button: connecting and signing as two steps was confusing. The portal's server checks the signer's address and sets a cookie valid for 7 days; the chat routes then send that address to the chat service. Code: `src/@utils/chatbot/signin.ts`, `src/pages/api/chatbot/signin.ts` (`deploy/hosting` 7c62fa08; chat service side 77d27bfa).
- **Chat service (VM `.env`):**
  - `CHATBOT_DAILY_LIMIT_PER_USER`: questions per address per day
  - `CHATBOT_DAILY_LIMIT_TOTAL`: answers per day for the whole site. **This is the real cost ceiling:** anyone can make new wallets for free, so a per-address limit alone does not cap the cost
  - `CHATBOT_ALLOWED_USERS`: addresses that may ask. Use the same list as `C2D_ALLOWED_ADDRESSES` to allow only the trial wallets

Only questions the model answers are counted; a question that matched no words and got the fixed reply is not. Days are UTC. Counts are kept on a VM volume, so a restart does not reset them. At the limit, the user gets a notice in the language of the question (Japanese or English).

Checked locally (2026-09-30, limit of 2 per address, throwaway wallets):

| Tried                                      | Result                                         |
| ------------------------------------------ | ---------------------------------------------- |
| Ask without signing in                     | Refused (401 `signin_required`)                |
| Sign with a different wallet               | Refused (signature does not match the address) |
| Change the address in the message and sign | Refused (message was not issued by this site)  |
| Change the cookie                          | Refused                                        |
| Sign in and ask twice                      | Claude answers                                 |
| Third question                             | "You have reached today's limit (2 questions)" |
| Restart with limits on                     | Counts are still there                         |
| Nothing set                                | Anyone can ask, as before                      |

**Mind the order.** If the VM has a limit or an allowlist but the portal lacks `CHATBOT_REQUIRE_SIGNIN`, everyone is told to sign in and nobody can ask. Set the portal first.

## Set it up on your own host

Assumes the node from [Self-hosting on Sepolia](/developers/self-hosting) with its Cloudflare Tunnel, and the portal on Vercel.

1. **Publish the algorithms and a dataset.** `zsh deploy/trial/usecases.zsh` publishes the Federalist sample and both algorithms with the trial wallet, waits for indexing, and runs one free job with each algorithm. Change `metadata/*.json` first if you use your own files (file URLs must point at a fixed commit).
2. **Put the DIDs into the portal.** Add the printed DIDs under `11155111` in `src/components/TextAnalysis/_constants.ts` (algorithm and datasets) and `src/components/ChatbotTrial/_constants.ts`. A dataset must trust the algorithm; the samples trust all algorithms (`"*"`).
3. **Create the chat service's hostname.** Add it to `deploy/ocean-node/cloudflared/config.yml` (here `cliox-chat.ldas.jp`) and create its DNS record: `cloudflared tunnel route dns cliox-node cliox-chat.ldas.jp`.
4. **Create the key** and hand it to the VM and to Vercel:
   `zsh deploy/ocean-node/scripts/setup-chatbot.zsh mdx-clio https://cliox-chat.ldas.jp <vercel project id> <vercel team id>`.
   1Password generates the key; it is never printed or written to disk.
5. **Start it:** `zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio`. Because `CHATBOT_API_KEY` is now in `.env`, this adds the `chatbot` and `ollama` services and downloads the model once (~1 GB).
6. **Redeploy the portal** so its functions see `CHATBOT_API_URL` and `CHATBOT_API_KEY`.

7. **Check that Vercel gets through Cloudflare.** On the trial, `https://cliox.ldas.jp/api/chatbot/health` first returned `Health check failed: Forbidden`: bot protection on the zone challenged Vercel's servers, as it had challenged the node VM ([known problem](/developers/known-problems)). `zsh deploy/ocean-node/scripts/cloudflare-allow-chatbot.zsh` adds a skip rule for the chat hostname only (rule `313d8c02…`, 2026-09-27). The service still refuses every call without the key.

## Use it (on the trial site)

**To just try the chatbot, no job is needed.** On the chatbot page, choose _Trial samples (Sepolia)_ and press "Load the sample". It loads the same 930 passages that the Knowledge passages job in step 2 produces (`public/samples/chatbot/federalist-knowledge.json`, the output of `chatbot_knowledge.py` as is).
Why: the Compute Jobs list on this page shows only jobs started from the portal in the same browser, so a first-time visitor saw an empty list and could not ask anything (reported and checked 2026-09-30).

To run the job yourself:

1. Connect a wallet on Sepolia that is allowed to run free jobs (see [the CLI page](/developers/trial-run)).
2. Open the Federalist Papers asset, choose the **Text analysis** algorithm, and start the free job. For the chatbot, do the same with **Knowledge passages**.
3. When the job has finished, open **Visualizations** (project _Email Text_) or **Chatbot** (project _Trial samples (Sepolia)_) and add the job.

Published on 2026-09-27 with the trial wallet (`0xedAa…262E`):

| Asset                                      | DID                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| The Federalist Papers, 85 essays (dataset) | `did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c` |
| Text analysis for the Visualizations page  | `did:op:83879b6695a4aae100753eff91487feafe82d8cf7cbd679afaad9654c1c0f09b` |
| Knowledge passages for the Chatbot page    | `did:op:4178768987eb40f3639ca75bb17fa7efd41476cbd957379dde54c6bc6d1b326f` |

One free job with each algorithm finished with exit code 0; the node's `outputs.tar` held the same five files (and the same 1.49 MB `final_output.json`) as the local runs.

What was checked on screen: on the Visualizations page the finished job appears with **Add** (local `next dev` against the live node, the trial wallet's address, 2026-09-27).
On the live portal (`cliox.ldas.jp`) a free job was started from MetaMask in a browser (an allowed address other than the trial wallet, 2026-09-27 20:38 UTC). It finished in 13 seconds and then waited at "Job settling" for the node's hourly settlement ([known problem](/developers/known-problems)).
The step after that — the signed download of `outputs.tar` and the charts — has not been checked yet.

## Limits

- The pages show only **your own** jobs (the wallet you connected), and on the trial only jobs **started from the portal in the same browser**. Ocean Node 4.2.0 returns `inputDID` and `algoDID` as `null` for free jobs, so the portal remembers both when you start the job (browser storage, `src/@utils/jobAlgorithmMemory.ts`). Jobs started with the CLI, in another browser, or before this change are not listed.
- The Visualizations page keeps upstream's project name _Email Text_ and chart titles ("Email Count Over Time"); the Federalist essays appear there.
- The _Cameroon Gazette_ visualization and the Cameroon / InterPARES / UdL chatbots still exist only on Pontus-X.
- A job appears up to an hour after it ends: it stays at "Job settling" until the node's hourly settlement, and the pages list only finished jobs.
- These two pages stay in English when the portal is switched to Japanese.
- The chat service runs on the same VM as the node (3 CPUs, 2.5 GiB for Ollama). One answer at a time; a second request while two are running gets "busy".
