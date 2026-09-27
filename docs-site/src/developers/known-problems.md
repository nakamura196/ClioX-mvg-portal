# Known problems

What cost us time while running Clio-X on Sepolia with Ocean Node 4.2.0.
Each entry says whether the cause is in Ocean, in Clio-X, or in our hosting.

## Records are bound to the node that encrypted them

**Where:** Ocean design. **Status:** by design; mitigations below.

An encrypted DDO is stored on chain together with the URL of the node that encrypted it.
When any node indexes the asset, it asks _that URL_ to decrypt; it never tries its own key.
Our 29 earlier assets were encrypted by two nodes we no longer run: a laptop node (12) and a cloud node at `http://16.192.66.21:8001` (16; one asset had no URL).
None of them indexes on the new node, although the new node reuses the cloud node's key.

- Publish through a hostname you control (`cliox-node.ldas.jp`), not an IP address, and keep the node key.
  Then the name can be pointed at a new machine.
- For archivists, the consequence is explained in [When the publishing service closes](/archivists/when-a-node-closes).
- Publishing the description unencrypted would keep the catalogue entry alive; see the next item.

## `--encrypt false` is rejected

**Where:** `@oceanprotocol/lib` 9.2.1 (used by `ocean-cli` 2.1.0). **Status:** report drafted, not filed.

`ocean-cli publish … --encrypt false` produces _“Unencrypted DDO hash does not match metadata hash”_ on Ocean Node 4.2.0.
The library hashes the DDO **including** `indexedMetadata`; the node removes `indexedMetadata` before checking.
The on-chain `metaDataHash` of both rejected transactions equals sha256 of the hex-encoded DDO _with_ `indexedMetadata`.
The CLI also needs `indexedMetadata.nft` for the NFT name, so you cannot leave it out, and the official example files have the same problem.

**Workaround:** publish encrypted.

## The node cannot reach its own public URL

**Where:** our Cloudflare zone. **Status:** fixed with a WAF skip rule.

Because the decryptor URL is the node's own public hostname, the node calls itself through Cloudflare.
Bot protection on the zone answered the VM with `403 cf-mitigated: challenge`, so encrypted assets never indexed.
Failed events are not retried: after fixing, the assets had to be published again.
Other servers (serverless functions, other Ocean nodes) calling the node are probably challenged as well.

## Search returns 0 results against Ocean Node

**Where:** Clio-X portal. **Status:** fixed on `deploy/hosting`.

The portal builds Elasticsearch queries for Aquarius. Ocean Node uses Typesense and returns an empty list for the same query.
A client-side fallback existed but only switched on for `localhost`, and it did not look inside arrays such as `services.type`.
We added `NEXT_PUBLIC_METADATACACHE_OCEAN_NODE` (default: host name does not contain “aquarius”).
After the fix, compute 4 / download 9 / datasets 4 / algorithms 5 — equal to counts taken directly from the node.
This will also affect upstream Clio-X once Pontus-X replaces Aquarius with Ocean Node.

## Every search returns all assets

**Where:** Clio-X portal (the fallback above). **Status:** fixed on `deploy/hosting` in 1715d358.

The fallback fetches everything from the node and re-applies the conditions in the browser. It passed the search-term condition (`query_string`) through as "no condition".
So "きりつぼ" and "genji" both returned all 77 assets. This was not specific to Japanese.
Now the term is split on spaces, and an asset matches when every word appears in its name, description, tags, author, DID and similar fields.
Japanese has no spaces between words, so the match is a substring match. Full-width and half-width, upper and lower case, and katakana and hiragana are treated as equal.
Counts checked on a local portal: "きりつぼ" 2, "キリツボ" 2, "genji" 60, "declaration" 1, "zzzz" 0.
There is no relevance ranking (results keep the chosen sort order).

## Downloading with MetaMask saves an error (file.json)

**Where:** Ocean Node 4.2.0, partly the portal. **Status:** not fixed; workaround available.

On 2026-09-27 downloading an algorithm saved `file.json` instead of the file. It contains `CALL_EXCEPTION` for `getERC721Address()`.
With a MetaMask smart account, the order transaction goes through MetaMask's delegation contract (`0xdb9B1e94…` on Sepolia, function `redeemDelegations`).
The node checks an order by treating the transaction's recipient as the datatoken (`erc20Address = txReceiptMined.to` in `dist/components/core/utils/validateOrders.js`). The recipient is the delegation contract, so the call fails.
The order itself succeeded: transaction `0xe7d8721a…` carries the datatoken's `OrderStarted` event.
The same asset downloaded correctly from a wallet that sends transactions directly (checked with Playwright).
The portal saves the node's error response as a file instead of showing it.

Workaround: turn off MetaMask's smart account for the account you use on Sepolia (not yet tested).
Proposed fix: the node should take the datatoken from the contract that emitted `OrderStarted`, not from the recipient. The portal should show an error response instead of saving it.

## The indexer restarts from the first block every 90 seconds

**Where:** Ocean Node. **Status:** worked around in our compose file.

If Ocean Node starts together with Typesense, it can fail to create its collections, and then cannot save the last indexed block
(_“Error updating last indexed block: Not Found”_).
Restarting the node fixes it. Our compose file now waits for Typesense `/health` (up to 120 s) before starting the node.

## A job receives only the first file of an asset

**Where:** Ocean Node 4.2.0. **Status:** worked around by publishing one archive.

The Kōi Genji monogatari TEI was first published as one asset with 54 file URLs.
The free job finished, but the result covered only chapter 1.
The node's `configuration.log` for that job says `Downloading asset 0` and fetches only `01.xml`.

**Workaround:** pack a multi-file collection into one `.tar.gz` and let the algorithm open it.
The worked example is in [CLI: publish and free compute](./trial-run#second-example-koi-genji-monogatari-tei).

## The subgraph stops on a dispenser it never saw

**Where:** Ocean subgraph (upstream commit `2f322ee`) with a truncated `startBlock`. **Status:** patch written (`deploy/hosting` commit `667637f4`); redeployed with a graft on 27 September; caught up at 07:05 UTC.

From 26 September 23:18 UTC the subgraph stayed at block 11,696,316 while Sepolia moved on (95,000 blocks behind on 27 September).
graph-node logged, once an hour: _missing value for non-nullable field `contract`_ in `handleTokensDispensed`, block 11,701,495.
The Dispenser and FixedRateExchange contracts are singletons shared by every datatoken.
Starting at block 11,459,550 we still receive their events for dispensers created earlier; the mapping then creates an empty entity that cannot be saved.
graph-node treats this as non-deterministic and retries the same block for ever.

What users saw: new assets were missing from the subgraph, so the asset page could not read the price (`Cannot read properties of null (reading 'templateId')`), and **“Datasets this algorithm can run on”** and the algorithm picker kept spinning.

**Fix:** `skip-unknown-singletons.patch` makes every Dispenser and FixedRateExchange handler return when the entity was never created.
Redeploy with a graft so indexing continues from the last good block instead of starting over:

```sh
zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio subgraph QmR86ay2HF9AVb7cAJRgeDibESySDJPY9wnQiaJVM75JRg 11696315
```

The graft block must be one **before** the last indexed block when the base failed: graph-node refuses the failed block itself (_not healthy … graft it starting at block 11696315 backwards_).

The same class of problem as the missing `templateId` (fixed earlier by `template-id-fallback.patch`): anything created before `startBlock` is unknown to the subgraph.

## "Allow all algorithms" (`*`) matched nothing

**Where:** the portal. **Status:** fixed in the portal (commit `3b8fdaae`).

`ocean-cli` publishes "any algorithm may run on this dataset" as `publisherTrustedAlgorithms: [{ "did": "*", … }]` and `publisherTrustedAlgorithmPublishers: ["*"]`.
The portal searched for an asset whose id is literally `*`, so the algorithm page showed **“No matching assets”** under “Datasets this algorithm can run on”, and the dataset page offered no algorithm.
The portal now treats `*` as "no restriction" in both lookups.

## Ocean Node 4.x no longer lists its service endpoints

**Where:** Ocean Node 4.2.0 vs the portal's `@oceanprotocol/lib` 3.1.3. **Status:** fixed in the portal (commit `616ce890`).

ocean.js 3.1.3 reads `serviceEndpoints` (name → `[method, path]`) from the node's root (`GET /`) to find the URL of every provider call.
Ocean Node 3.2.0 returned it; 4.2.0 does not (the routes themselves still exist at the same paths).
Without the list, ocean.js silently returns `null`: the asset page said **“No compute environments available”** and **“No file information”**, and compute could not start.
The portal now adds the 3.2.0 list when the node reports `software: "Ocean-Node"` without `serviceEndpoints` (`src/@utils/oceanNodeEndpoints.ts`).
Note that ocean.js asks for `fileinfo` while the node names it `fileInfo`; both are provided.

## Assets published with the CLI show a broken thumbnail

**Where:** `@oceanprotocol/lib` 9.2.1 (used by `ocean-cli` 2.1.0) and the portal. **Status:** fixed in the portal (commit `f0307b02` on `deploy/hosting`).

`createAsset()` in ocean.js mints the data NFT with the fixed `tokenURI` `"aaa"`.
The portal treated any non-`data:` tokenURI as an image address, so it rendered `<img src="aaa">`.
The image failed, and the NFT name (the alt text) spilled out of the 60 px box at the top of the asset page.
The portal now uses only values that start with `data:image/`, `http(s)://` or `/`, and falls back to the Clio-X logo when the image fails to load.
The on-chain value stays `"aaa"`; it cannot be changed without a transaction from the NFT owner.

## Visualizations and Chatbot find no results on Ocean Node 4.x

**Where:** Clio-X portal (written for the separate result files of Pontus-X). **Status:** fixed on `deploy/hosting` (`39bd5c29`).

Ocean Node 4.x returns a job's outputs as one `outputs.tar` (plus three logs); the two use-case pages look for files such as `wordcloud.json` or `final_output.json` by name, so they showed nothing.
The portal now opens the tar in the browser. Details: [Visualizations and Chatbot](/developers/usecases).

## Upstream's public chatbot backend no longer fits the portal

**Where:** Clio-X (`ciferresearch/Cliox-rag-chatbot-backend`, last commit 2025-07-17). **Status:** replaced on the trial by our own small service.

The portal reads the answer as a stream of server-sent events and deletes sessions with `DELETE /knowledge/session`; the public backend answers with one JSON body and has no delete. It also has no licence file.
The trial runs `deploy/ocean-node/chatbot/server.py` instead. Details: [Visualizations and Chatbot](/developers/usecases).

## Free jobs do not appear on Visualizations and Chatbot

**Where:** Ocean Node 4.2.0 and the Clio-X portal. **Status:** fixed on `deploy/hosting` (`a64cb256`), with a limit.

Three things together, all measured on 2026-09-27:
the pages build the job list from on-chain orders, and free jobs make none;
for free jobs the node returns `inputDID` and `algoDID` as `null`, so the pages cannot tell which algorithm ran on which dataset;
and the result download was signed the old ocean.js way, which our node refuses.
The portal now asks our own node for the jobs, remembers the algorithm and dataset in the browser when a job is started, and signs downloads like the Profile page does.
**Limit:** jobs started with the CLI or in another browser still cannot be matched.

## Server functions on Vercel do not see `CHATBOT_API_KEY`

**Where:** Clio-X portal on Vercel. **Status:** fixed (`2357e5ee`).

The variable was set for the deployment, but the chat service logged every call from the portal as "key missing".
Reading it through `serverRuntimeConfig` in `next.config.js` (as `src/pages/api/contact-resend.ts` already does for its key) fixed it.
The same service also had to learn chunked request bodies: Vercel sends the 1.5 MB upload that way (`d1fa37fb`).

## A finished job stays at "Job settling" for up to an hour and is not listed

**Where:** Ocean Node 4.2.0 configuration. **Status:** not fixed (the fix is known).

On 2026-09-27 a free job started from the trial portal finished in 13 seconds and then sat at "Job settling" (status 71).
After a job ends the node marks it as settling, and settles payments (`claimPayments`) **once an hour**; only then does the job become "Job finished" (status 70). A free job has nothing to settle but still waits for that run.
The Visualizations and Chatbot pages list only status 70 (`src/components/TextAnalysis/JobList.tsx`), so the job is missing until then.
The interval is `paymentClaimInterval` (seconds, default 3600, minimum 60) on each cluster in `DOCKER_COMPUTE_ENVIRONMENTS` (`deploy/ocean-node/docker-compose.yml`). Check it against the claim deadline for paid jobs (`claimDurationTimeout`) before changing it.

## The Visualizations and Chatbot pages are not translated into Japanese

**Where:** Clio-X portal (these pages do not use the string dictionary). **Status:** not fixed.

With the portal switched to Japanese (`/ja/…`, or "EN / 日本語" at the top right), these two pages still show "Compute Jobs", "No visualization data available", "Clear Data" and so on in English.
The text in `src/components/TextAnalysis/`, `ChatbotUnified/` and `ChatbotTrial/` does not go through `src/i18n/locales/{en,ja}.json`. The asset page (including job status) is translated.

## Smaller things

- The profile sales counter showed the raw key `profile.sales`: before the count loads there is no number, so the translation could not be chosen. Fixed in 02abf67c.
- Sepolia showed as “Unknown network” on asset cards: a custom chain was not added back to the network metadata. Fixed.
- Subgraph `_meta.block` only moves on blocks with events, so it can look stalled. Read the graph-node logs instead.
- Tenderly's public RPC answered 429 to the CLI; `https://ethereum-sepolia-rpc.publicnode.com` worked.
- The portal's server-side rendering breaks on Node 25 (`localStorage.getItem is not a function`). Use Node 22.
- mdx blocks outbound UDP, so cloudflared's QUIC fails (error 1033). Use `--protocol http2`.
