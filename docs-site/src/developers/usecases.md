# Visualizations and Chatbot on Sepolia

The portal has two "use case" pages that turn the result of a compute job into something to look at:

- **Visualizations** (`/usecases/visualizations`): word cloud, sentiment by day, documents per day and a corpus summary.
- **Chatbot** (`/usecases/chatbot`): questions answered from passages of the documents.

Upstream, both pages only know assets on Pontus-X.
This page records what was needed to make them work on the Sepolia trial, and how to set them up on another host.
Portal changes are on branch `feat/usecases-sepolia`; commits are given below.

## Status on 27 September 2026

**The two pages do not show Sepolia results on [cliox.ldas.jp](https://cliox.ldas.jp) yet.**
The portal changes below are on branch `feat/usecases-sepolia` and have not been merged into `deploy/hosting`, which is what the trial site runs.

| Part                               | State (checked 27 Sep 2026, 18:00 UTC)                                                                                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Assets on the trial node           | Published and indexed (table below)                                                                                                                                         |
| Trial jobs with the two algorithms | Not run yet: the trial wallet's job list has no job for either algorithm                                                                                                    |
| DIDs in the portal code            | Real Sepolia DIDs (table below), committed as `fb777a6d` on `feat/usecases-sepolia`; branch not merged                                                                      |
| Chat service `cliox-chat.ldas.jp`  | Running: `GET /api/health` → `{"status": "healthy", "ollama_connected": true, "model": "qwen2.5:1.5b"}` from outside                                                        |
| Portal (Vercel) → chat service     | Not tested. Vercel functions run from data-centre addresses, which the `ldas.jp` zone's bot protection challenged before (see [Known problems](/developers/known-problems)) |

| Asset                                                                      | DID                                                                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The Federalist Papers (1787-1788), 85 essays - dated sample                | [`did:op:88084b2…`](https://cliox.ldas.jp/asset/did:op:88084b2a810deca76dde649e3598410445b199379c3709a6d9d9d948f8484a9c) |
| Text analysis for the Visualizations page (algorithm)                      | [`did:op:83879b6…`](https://cliox.ldas.jp/asset/did:op:83879b6695a4aae100753eff91487feafe82d8cf7cbd679afaad9654c1c0f09b) |
| Knowledge passages for the Chatbot page (algorithm)                        | [`did:op:4178768…`](https://cliox.ldas.jp/asset/did:op:4178768987eb40f3639ca75bb17fa7efd41476cbd957379dde54c6bc6d1b326f) |
| Declaration of Independence (1776) - sample record (first trial, no dates) | [`did:op:04f7924…`](https://cliox.ldas.jp/asset/did:op:04f79245ba012ab323600b60bb537c865560ca18867025a3d31b38f4560b9787) |

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

| What                                                                               | Where                                                                                          | Commit     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| Open `outputs.tar` in the browser, pass its files on by name                       | `src/@utils/computeResultFiles.ts`, both `JobList.tsx`                                         | `39bd5c29` |
| Send a shared key to the chat service (only if `CHATBOT_API_KEY` is set)           | `src/@utils/chatbot/upstreamAuth.ts`, `src/pages/api/chatbot/*.ts`                             | `f4914b6f` |
| Text-analysis and knowledge-passage algorithms, Federalist Papers sample           | `deploy/trial/algorithm/`, `deploy/trial/sample/`                                              | `dcf93888` |
| A small chat service + Ollama, started only when a key is set                      | `deploy/ocean-node/chatbot/server.py`, `docker-compose.yml` (profile `chatbot`)                | `412841d5` |
| Publish script for the three assets and two test jobs                              | `deploy/trial/usecases.zsh`, `deploy/trial/metadata/*`                                         | `7808ea0c` |
| Sepolia DIDs; a "Trial samples (Sepolia)" chatbot project, listed first on Sepolia | `src/components/TextAnalysis/_constants.ts`, `src/components/ChatbotTrial/`, `ChatbotUnified/` | `fb777a6d` |

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
Not yet measured on the trial VM, where Ollama gets 3 CPUs and no GPU; expect it to be slower than the Mac.

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

If the portal's chatbot calls fail with 403 while `/api/health` answers from your own machine, the zone's bot protection is challenging Vercel; the node needed a WAF skip rule for the same reason (`deploy/ocean-node/scripts/cloudflare-allow-node.zsh`).

## Use it (on the trial site)

1. Connect a wallet on Sepolia that is allowed to run free jobs (see [the CLI page](/developers/trial-run)).
2. Open the Federalist Papers asset, choose the **Text analysis** algorithm, and start the free job. For the chatbot, do the same with **Knowledge passages**.
3. When the job has finished, open **Visualizations** (project _Email Text_) or **Chatbot** (project _Trial samples (Sepolia)_) and add the job.

The DIDs are in [Status on 27 September 2026](#status-on-27-september-2026). This has not been tried on the live site yet.

## Limits

- The pages show only **your own** jobs (the wallet you connected). Jobs started by someone else, or by the CLI's trial wallet, are not listed.
- The Visualizations page keeps upstream's project name _Email Text_ and chart titles ("Email Count Over Time"); the Federalist essays appear there.
- The _Cameroon Gazette_ visualization and the Cameroon / InterPARES / UdL chatbots still exist only on Pontus-X.
- The chat service runs on the same VM as the node (3 CPUs, 2.5 GiB for Ollama). One answer at a time; a second request while two are running gets "busy".
