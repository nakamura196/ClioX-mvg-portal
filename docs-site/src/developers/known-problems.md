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

## Downloading with MetaMask saves an error (file.json) {#kp-metamask-smart-account}

**Where:** Ocean Node 4.2.0, partly the portal. **Status:** fixed on our node by a patch (2026-11-25); the portal part is not fixed.

On 2026-09-27 downloading an algorithm saved `file.json` instead of the file. It contains `CALL_EXCEPTION` for `getERC721Address()`.
With a MetaMask smart account, the order transaction goes through MetaMask's delegation contract (`0xdb9B1e94…` on Sepolia, function `redeemDelegations`).
The node checks an order by treating the transaction's recipient as the datatoken (`erc20Address = txReceiptMined.to` in `dist/components/core/utils/validateOrders.js`). The recipient is the delegation contract, so the call fails.
The order itself succeeded: transaction `0xe7d8721a…` carries the datatoken's `OrderStarted` event.
The same asset downloaded correctly from a wallet that sends transactions directly (checked with Playwright).
The portal saves the node's error response as a file instead of showing it.

Seen again on 2026-11-25 when downloading 羅生門 (`did:op:4897cc9c…bf61`) from `/ja/asset/…`. The order transaction `0x37a84998…0eb5` went to `0xdb9B1e94…` and succeeded (the datatoken `0x560d…8AdD` emitted `OrderStarted`), and the node log shows the same `CALL_EXCEPTION` at 05:43:49 UTC. The wallet `0x6E43…32C3` has an EIP-7702 delegation (its code points to `0x63c0c19a…e32b`). Not related to the move to Cloudflare.

**Fixed on the server (2026-11-25, 23:14 MST).** Turning the smart account off did not help: an order placed earlier through the relay is reused, and a second account's order (`0x61796ba5…26f9`) also went to `0xdb9B1e94…`.
We now mount a patched `validateOrders.js` over the image (`deploy/ocean-node/patches/`, see its README).
It takes the datatoken from the asset description when that contract emitted logs in the order transaction, and reads `OrderStarted` only from the datatoken's own logs.
Tested inside the container on both real orders: upstream throws `CALL_EXCEPTION`; the patch answers "Transaction is valid." and still rejects a wrong user.
The portal still saves an error answer as a file; that part is not fixed.
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

## Paid (fixed-price) assets show no price and no Buy button

**Where:** our hosting (the Sepolia subgraph manifest). **Status:** fixed (`deploy/hosting` commit `90b3e126`); redeployed on 30 September as deployment `QmXgVEofKWgHfr57FGAZR2AucCkfkeP8ZmVJQLcqHmAqXj`. The asset page now shows the price, **Buy for 1 day** and **1 sale**. The price token is shown as its address (`0xfFf99…`) instead of "WETH"; not fixed yet.

Measured on 30 September: the subgraph had indexed **no** fixed-rate exchange at all (`fixedRateExchanges` returned `[]`), even for a paid asset published and bought that day.
The portal reads prices from the subgraph. With no exchange, `getAccessDetailsFromTokenPrice` returns `NOT_SUPPORTED`, so a paid asset has no price and no Buy button.
Buying still works on chain (see below); only the portal cannot see the price.

The cause is the truncated `startBlock` again.
Upstream declares FixedRateExchange only as a template, started by the router's `FixedRateContractAdded` event. That event is older than block 11,459,550, so the template never starts.
We had already declared the Dispenser as a static data source for the same reason, but not the FixedRateExchange.

**Fix:** declare FixedRateExchange (`0x80E63f73cAc60c1662f27D2DFd2EA834acddBaa8`) as a static data source in `deploy/ocean-node/subgraph/subgraph.sepolia.yaml`, like the Dispenser.
Redeploy with a graft from a block before the first paid asset (created in block 11,815,074). graph-node refuses a graft block within 250 blocks of the base's head (_within the reorg threshold of 250 blocks_), so 11,815,073 was refused and 11,814,900 used:

```sh
zsh deploy/ocean-node/scripts/deploy.zsh mdx-clio subgraph QmPjEAoiT91w9XwEdtFQsD6bNR7WwHdrcw2mvXZsJsW16K 11814900
```

With a graft, exchanges created before that block stay unindexed. The skip patch above keeps their events from stopping the subgraph. Re-index from `startBlock` (no graft) if older paid assets matter.

## Paid assets published with `ocean-cli` can be bought only by their publisher

**Where:** Ocean (ocean.js 9.2.1 `createAsset`, used by `ocean-cli publish`). **Status:** avoided: `deploy/trial/paid.mjs` creates the price itself.

When the DDO has a price above 0, `createAsset` creates the fixed-rate exchange with `allowedConsumer` set to the publisher's own address.
The exchange then refuses every other buyer.
The portal leaves `allowedConsumer` empty (anyone may buy). `paid.mjs` does the same.
Read from the bundled code (`node_modules/@oceanprotocol/lib/dist/lib.modern.mjs`), not tried with a second buyer.

## There is no test OCEAN on Sepolia

**Where:** Ocean (the Sepolia OCEAN token). **Status:** worked around by pricing in Sepolia WETH.

Only the token's owner can mint Sepolia OCEAN (`0x1B083D8584dd3e6Ff37d04a6e7e82b5F622f3985`). A dry run from the trial wallet reverted with _Ownable: caller is not the owner_.
None of our wallets hold any. The portal's publish form prices in OCEAN, so nobody could buy such an asset.

`deploy/trial/paid.mjs` prices in Sepolia WETH (`0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`) instead: anyone can wrap test ETH into it.
The router accepts WETH but does not list it as approved, so the Ocean community fee is 0.2% instead of 0.1%.
The portal's buy flow uses whatever token the exchange uses, so a WETH price needs no portal change.

Measured on 30 September (`zsh deploy/trial/paid.zsh publish`, then `buy <did>`): asset `did:op:f5fea961eef1e8ec393633c09ebea065731d37bc3d73fe63bf746a92e702d85a` at 0.001 WETH.
The purchase transaction `0x8ac83fef42c88fb97bcb0cb3ee2e5148ed7b3ec557bc43a36948c197cfc2f800` moved 0.001002 WETH from the buyer.
0.001 WETH reached the seller, and 0.000002 WETH stayed in the exchange as the community fee.
One datatoken was minted to the buyer and burned by the order. The download then returned HTTP 200.

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

## A finished job stays at "Job settling" and is not listed (up to an hour; now 5 minutes)

**Where:** Ocean Node 4.2.0 configuration. **Status:** fixed on 2026-09-30 (interval shortened to 5 minutes).

On 2026-09-27 a free job started from the trial portal finished in 13 seconds and then sat at "Job settling" (status 71).
After a job ends the node marks it as settling, and settles payments (`claimPayments`) **once an hour**; only then does the job become "Job finished" (status 70). A free job has nothing to settle but still waits for that run.
The Visualizations and Chatbot pages list only status 70 (`src/components/TextAnalysis/JobList.tsx`), so the job is missing until then.
The interval is `paymentClaimInterval` (seconds, default 3600, minimum 60) on each cluster in `DOCKER_COMPUTE_ENVIRONMENTS` (`deploy/ocean-node/docker-compose.yml`). Ocean Node refuses to create the engine unless six intervals fit into the claim deadline for paid jobs (`claimDurationTimeout`, `src/components/c2d/compute_engines.ts`), so shorter is the safe direction.
On 2026-09-30 it was set to `300` (deploy/hosting `4ccc0598`); after the redeploy the node log reads `Payments claim timer started (interval: 5 minutes)`. A finished job now appears within about 5 minutes.

## The Visualizations and Chatbot pages are not translated into Japanese

**Where:** Clio-X portal (these pages do not use the string dictionary). **Status:** not fixed.

With the portal switched to Japanese (`/ja/…`, or "EN / 日本語" at the top right), these two pages still show "Compute Jobs", "No visualization data available", "Clear Data" and so on in English.
The text in `src/components/TextAnalysis/`, `ChatbotUnified/` and `ChatbotTrial/` does not go through `src/i18n/locales/{en,ja}.json`. The asset page (including job status) is translated.

## The catalogue lists assets nobody can use from this portal

**Where:** Ocean (the node indexes every asset on the chain) and the Clio-X portal (it listed them all). **Status:** fixed on `proto/paper-fig` in `e3c63f7f`; live on cliox.ldas.jp since 2026-11-25 (`deploy/cf-paper-fig`, `cd07f8bc`). Not yet on `deploy/hosting`.

Our node indexes every Ocean asset published on Sepolia, not only the ones it serves.
So search and the tag lists also showed assets published by other people, whose files are served by a provider this portal cannot reach.
Counted on 2026-11-25 from the node's metadata (by the `serviceEndpoint` of each asset's services):

| Provider                                | Assets   | What they are                                                                                                                               |
| --------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://cliox-node.ldas.jp` (our node) | 11       | the trial's assets                                                                                                                          |
| `http://127.0.0.1:8001`                 | 32       | owner `0x1ad7…6958`; names such as `surtin-proj-matlab-test10`. Likely tests by the upstream team (a guess from the names and author field) |
| `https://provider.oceanprotocol.com`    | 5        | Ocean's public provider                                                                                                                     |
| `ipfs://…`                              | about 60 | owner `0xA787…A3aA`: our own Tale of Genji collation, one asset per chapter, published on purpose without a provider (genji-witness)        |

A `127.0.0.1` provider is the publisher's own machine, so downloads and jobs on those assets cannot work from anywhere else.
Note that the `?demo=1` asset `ee03ec…` ("release anonymized") is one of the `0x1ad7` assets.

The portal now keeps an asset in search results and tag lists only when all of its services are served by one of the providers in `NEXT_PUBLIC_CATALOGUE_PROVIDERS` (comma-separated origins).
An entry ending in `:` matches a whole scheme. The default is the node the portal reads (`NEXT_PUBLIC_METADATACACHE_URI`) plus `ipfs:`, so our Genji collation stays listed (`3aacfe5a`); `*` turns the filter off.
Direct links (`/asset/<did>`) still open any asset.
Code: `catalogueProviders` in `app.config.js`, applied in `src/@utils/aquarius/index.ts` (tests in `index.test.ts`).
Checked on the live site on 2026-11-25 (version `965039d0`): the catalogue shows 67 assets, "genji" finds 60, and "surtin" finds none.

## Asset pages answer 404 on a local `next dev` server (fixed)

Since the move to Cloudflare (`242e0054`), the portal is a static export.
Pages with an id in the address (`/asset/<did>`, `/asset/<did>/edit`, `/profile/<account>`, `/experiment/finding-aid/<did>`) are built once, as a `_` page, and the Cloudflare Worker serves that page for every id (`rewriteDynamicPath` in `worker/index.ts`).
`next dev` has no Worker in front of it, so every such page answered 404 locally.
This included the Fig. 1 URL that the paper's README tells readers to open after `npm start`.
The cause is in our hosting, not in Ocean or Clio-X.

Fixed on `deploy/hosting` in `9a3cf172`: under `next dev` these pages are rendered on request (`fallback: 'blocking'`); the export still builds only `_`.
Checked on 2026-11-25: the Fig. 1 asset page with `?demo=1&env=a` and the finding-aid page open on `localhost:8012`, with the comparison table.

## Header, menu and footer stay in English on `/ja/` pages (fixed)

**Where:** our hosting (the static export). **Status:** fixed and deployed on `deploy/hosting` in `f4ad71f9`.

With Japanese selected, `/ja/publish/5/` showed the page body in Japanese but the menu (Catalogue, Publish, …), the tab title and the footer in English.
These parts read the language from Next's `router.locale`.
In the static export served by the Cloudflare Worker, `router.locale` is always undefined, so they always fell back to English.
The page body uses `useActiveLocale()` (`src/i18n/useActiveLocale.ts`), which also looks at i18next and the `/ja/` prefix, and so was right.
The same pattern was in eight files: the site menu and title (`MarketMetadata`), the landing page copy, the contact form, the footer's privacy link, and four prototype files.
All now call `useActiveLocale()`.
Checked on 2026-11-25 on a local `wrangler dev`: `/ja/publish/5/` has a Japanese menu, title and footer; `/publish/5/` stays English.

## Publish preview raises "[Initialize check file did] Error: … is not valid JSON" (fixed)

**Where:** Clio-X (upstream code). **Status:** fixed and deployed on `deploy/hosting` in `a539c7fd`.

Opening `/publish/5/` (Preview) with a wallet connected but no file entered on step 2, for example by going to the address directly, showed four red error notices.
The preview asset is not on chain yet.
With no file URL, `AssetActions` falls back to asking the node about the asset's DID (`getFileDidInfo`).
The node answers with the plain text `Invalid request parameters`, which the Ocean library tries to read as JSON.
Measured on 2026-11-25 against `https://cliox-node.ldas.jp/api/services/fileInfo`: an empty DID returns `Invalid request parameters`; a URL file without `method` returns `Error validating the URL file: URL or method are missing`; with `"method":"get"` it returns the file info.
The notice repeats because the check runs again whenever the form values change.
The preview now skips the check when it has no file URL (`src/components/Asset/AssetActions/index.tsx`).
The missing-method case was fixed earlier in `357abc99`.

## Handover: what was found on 2026-11-25, by cause

While publishing a new asset (羅生門, `did:op:4897cc9c…bf61`) through the portal on 2026-11-25, we hit the problems below.
For whoever takes over the code, they are sorted by where the cause is.

| Cause                                                                           | Problem                                                                                                          | Entry                               |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Clio-X (upstream code), with Ocean Node 4.x                                     | URL files without `method` are rejected                                                                          | [below](#kp-url-method)             |
| Clio-X (upstream code), with Ocean Node 4.x                                     | The DDO encrypt request is rejected because it is unsigned                                                       | [below](#kp-unsigned-encrypt)       |
| Our hosting (Cloudflare static export, regression of `242e0054`)                | Submit on the last publish step answered 404                                                                     | [below](#kp-publish-step6)          |
| Our hosting (Cloudflare static export, regression of `242e0054`)                | "Owned by" opens an empty profile                                                                                | [below](#kp-profile-owner)          |
| Our hosting (Cloudflare static export, regression of `242e0054`)                | Nine smaller differences from Vercel, mostly on `/ja` pages                                                      | [below](#kp-static-export-audit)    |
| Our hosting (server)                                                            | Index and subgraph stopped on RPC rate limits                                                                    | [below](#kp-rpc-rate-limit)         |
| Ocean Node 4.x, with a MetaMask smart account (seen again; patched on our node) | Download saves an error file instead of the text                                                                 | [above](#kp-metamask-smart-account) |
| Not a problem (upstream behaviour)                                              | "External content not allowed", empty token page on Etherscan, "No pricing schema" while the subgraph catches up | [below](#kp-expected-messages)      |

The "regression" rows did not happen on the Vercel deployment before 23 November 2026.
Upstream Clio-X does not have them.

## URL files without a method are rejected by Ocean Node 4.x (fixed) {#kp-url-method}

**Where:** Clio-X (upstream code), shown up by Ocean Node 4.x. **Status:** fixed and deployed on `deploy/hosting` in `1df55ba3` and `357abc99`.

Ocean Node 4.x requires a `method` on every URL file.
The upstream publish form and asset page send URL files without one.
The node answers `Error validating the URL file: URL or method are missing` (measured on 2026-11-25 against `https://cliox-node.ldas.jp/api/services/fileInfo`).
The file check on publish step 2 and on the asset page failed.
URL files now default to `get` (`src/@utils/ddo.ts`, `FilesInput`, `src/components/Asset/AssetActions/index.tsx`).
Any deployment of the upstream portal against Ocean Node 4.x will hit this.

## Publishing fails at step 2 because the DDO encrypt request is unsigned (fixed) {#kp-unsigned-encrypt}

**Where:** Clio-X (upstream code), shown up by Ocean Node 4.x. **Status:** fixed and deployed on `deploy/hosting` in `fd46e0fe` and `72935701`.

Ocean Node 4.x accepts an encrypt request only when it is signed by the publisher's wallet.
The upstream portal calls `ProviderInstance.encrypt` without a signature.
ocean.js then returns the node's error text as if it were the encrypted DDO.
The portal wrote that text on chain as the asset's metadata, and no node could index the asset.
The portal now signs the request for our node (`encryptViaOceanNode`, `src/@utils/oceanNodeAuth.ts`), in both the publish flow and `setNFTMetadataAndTokenURI` (also used by Edit).
It also refuses a result that is not hex, so the error can no longer reach the chain.
Publishing reuses the DDO encrypted in step 2 instead of encrypting a second time.

## Submit on the last publish step answers 404 (fixed) {#kp-publish-step6}

**Where:** our hosting (the static export, a regression of `242e0054`). **Status:** fixed and deployed on `deploy/hosting` in `d4dfe27d`.

The static export built only `/publish/1` to `/publish/5`.
Submitting moves to `/publish/6`, which did not exist, so the Worker answered 404 and publishing could not finish.
`getStaticPaths` in `src/pages/publish/[step].tsx` now lists step 6 too.

## "Owned by" opens an empty profile (fixed, not yet deployed) {#kp-profile-owner}

**Where:** our hosting (the static export, a regression of `242e0054`). **Status:** fixed on `deploy/hosting` (local check done; not yet deployed).

On an asset page, the owner link opens `/profile/<address>/`.
It showed 0 sales, 0 published and "Please connect your wallet.", while the header's profile link (`/profile/`) listed the same wallet's assets.
The static export builds `/profile/[account]` once, as `_`, and the Worker serves that page for every address.
The page read the address from `router.query.account`, which is `_` there, so it never knew whose profile to show.
The move to Cloudflare added `useDynamicParam` (`src/@utils/useDynamicParam.ts`) for exactly this and used it on the asset pages, but not on the profile page.
The profile page now uses it (`src/pages/profile/index.tsx`), and compares the address with the wallet regardless of letter case.
Checked on 2026-11-25 on a local `wrangler dev`: `/profile/0x6E43…32C3/` lists 羅生門 (Free).

## Smaller differences from Vercel after the move to the static export (fixed, not yet deployed) {#kp-static-export-audit}

**Where:** our hosting (the static export, regressions of `242e0054`). **Status:** fixed on `deploy/hosting` (local check done; not yet deployed). Found by reading the code on 2026-11-25.

The static export has no Next locale routing and exports one `_` page for each dynamic route. Several things that Vercel did for free stopped working:

1. `/ja/asset/…` did not show the "External content" prompt, and `/ja/search` got the wrong search-bar mode. The page address keeps the `/ja` prefix, and `src/components/@shared/Page/index.tsx` compared it with `/asset` and `/search`. The prefix is now removed before the check.
2. The guided tour on `/ja` said it was lost and jumped to the English page (`src/experiment/tour/steps.ts`, same cause).
3. On `/ja`, clicking a link dropped `/ja` from the address. The page stayed Japanese, but a reload or a copied link came back in English. `src/i18n/useStaticExportLocale.ts` (called from `_app.tsx`) adds `/ja` back after each move.
4. `<html>` had no `lang` attribute on any page. The same hook now sets `en` or `ja`.
5. Opening an asset, profile or finding-aid page from a link reloaded the whole page, and on `/ja` the reload came back in English. Only the `_` page data was exported, so Next's data request answered 404. The Worker now serves the `_` data for any id.
6. `/ja/imprint` and `/ja/terms` showed English text. `src/pages/[slug].tsx` now ships both languages and picks one in the browser.
7. `/experiment?view=…` stayed on the index instead of going to the two-condition page, because the exported page answered before the Worker. `wrangler.jsonc` now sends `/experiment` to the Worker first.
8. `/ja/publish` and `/ja/signup` answered 404. The Worker's old-address redirects now also match `/ja`.
9. Every page requested Vercel's analytics script and got 404. It is no longer loaded in the static export.

Checked on 2026-11-25 on a local `wrangler dev`: on `/ja/`, moving to search and then to an asset keeps `/ja` without a full reload; reload and Back stay Japanese; `/ja/asset/…` shows the External content prompt.

## New assets do not appear because the RPC rate-limits our server (fixed) {#kp-rpc-rate-limit}

**Where:** our hosting (the node server `mdx-clio`). **Status:** fixed on the server on 2026-11-25; the repository's `deploy/ocean-node/` has the same settings.

The server runs two programs that both read Sepolia.

- The **index** (inside Ocean Node) keeps the asset descriptions. Search and asset pages read it. When it stops, new assets are missing from search and their pages answer "Could not retrieve asset".
- The **subgraph** (graph-node) keeps prices, orders and sales counts. When it stops, asset pages show "Data out of sync" and "No pricing schema available".

Both used Tenderly's public gateway (`https://sepolia.gateway.tenderly.co`), which has no key and limits by IP address.
The subgraph used up the limit: in 30 minutes, 44 answers were 429.
The index then failed too: `599 CLIENT ESCALATED SERVER ERROR (429 Too Many Requests; exceeded maximum retry limit)`.
From the server even `eth_blockNumber` answered 429, while the same request from another machine succeeded.

What we measured for other free endpoints (2026-11-25):

- publicnode refuses `eth_getLogs` without an address, which the index needs.
- dRPC's free plan does not serve Sepolia (`chain is not available on free plan`).
- Alchemy's free plan answers `eth_getLogs` for at most 10 blocks, and limits requests per second.

What we set:

- Both now use Alchemy (1Password item "sepolia rpc alchemy"; `SEPOLIA_SUBGRAPH_RPC` and `SEPOLIA_INDEXER_RPC` in the server's `.env`).
- The index reads 10 blocks per request (`SEPOLIA_INDEXER_CHUNK_SIZE=10`, used as `chunkSize` in `RPCS`).
- graph-node reads 10 blocks per request, polls every 6 s, and sends at most 2 requests at once (`GRAPH_ETHEREUM_MAX_BLOCK_RANGE_SIZE`, `ETHEREUM_POLLING_INTERVAL`, `ETHEREUM_RPC_MAX_PARALLEL_REQUESTS`). With the default of 64 parallel requests, the two programs together got 429 from Alchemy too.

After the change, the asset was indexed within a minute.
Both share one free Alchemy key.
If 429 comes back, give the index its own key (a free Tenderly account, or a second Alchemy app).

**Later the same day (22:50 MST):** sharing the key failed again.
graph-node got 429 from Alchemy on `eth_getTransactionReceipt` and stopped at block 12214280 (about 300 blocks behind).
Ocean Node uses the same RPC (`RPCS`) to answer downloads, and two downloads at 05:51 and 05:53 UTC failed with `Unable to detect provider network: (TIMEOUT)`.
The portal then saved the node's answer `Download handler: TIMEOUT` (25 bytes) as `file.html` instead of showing an error.
What we changed: graph-node went back to Tenderly's gateway with 500 blocks per request (`GRAPH_ETHEREUM_MAX_BLOCK_RANGE_SIZE: '500'`); the index and downloads stay on Alchemy.
After the restart (05:54 UTC) no more timeouts were logged, and Alchemy answered `eth_chainId` from the server in about 40 ms.
If a download saves a small `file.html` or `file.json`, open it: a one-line error means try again, not that the asset is broken.

## Messages on a new asset page that are expected {#kp-expected-messages}

**Where:** upstream behaviour. **Status:** not a problem.

- **"External content not allowed … Do you want to allow it?"** appears on every asset page until the reader presses Allow (kept in a cookie). It is a privacy setting from upstream, not an error. Our Japanese pages (`/ja/asset/…`) did not show it; that was ours and is fixed ([above](#kp-static-export-audit), item 1).
- **"Accessed with GXAT"** links to the datatoken on Etherscan. For a free asset, tokens are made only when someone gets access, so a new asset's token page shows no holders and a supply of 0 (seen on 2026-11-25 for `0x560d…8AdD`).
- **"No pricing schema available"** and **"Data out of sync"** appear while the subgraph is behind the block where the asset was published (羅生門: block 12,214,097, subgraph at 12,213,272). They go away when it catches up.

## "Switch Wallet" does nothing (fixed) {#kp-switch-wallet}

**Where:** Clio-X (upstream code). **Status:** fixed and deployed on `deploy/hosting` in `de9b67b6` (Version `8b0045a7`, 2026-11-25).

To test buying an asset from a second account, we added a second account in MetaMask, but the portal kept showing the first one.
Pressing "Switch Wallet" in the account menu did nothing.
Two things combined (code read and checked in the browser on 2026-11-25):

- The button called wagmi's `connect()` without naming a connector, so nothing happened (`src/components/Header/Wallet/Details.tsx`).
- MetaMask shares only the accounts that were allowed for the site. `eth_accounts` on cliox.ldas.jp returned only `0x6E43…32C3`, so switching accounts inside MetaMask did not reach the portal either.

The button now sends `wallet_requestPermissions`. MetaMask opens its account picker, and the portal follows the chosen account through MetaMask's `accountsChanged` event.
Checked on a local portal: after choosing the second account, the header showed `0x05f1…C085`.

Before this fix, the workaround was: in the account menu press "Disconnect", choose the other account in MetaMask, then connect again and allow only that account.

## Smaller things

- Every page scrolled sideways by 8px on a phone (390px wide): the header's menu row bleeds by 1rem, more than the menu's padding at 480px and narrower. Cause in the portal's header (upstream). Fixed on `deploy/hosting` in `2b65e793`; checked on nine pages at 390px.
- The profile sales counter showed the raw key `profile.sales`: before the count loads there is no number, so the translation could not be chosen. Fixed in 02abf67c.
- Sepolia showed as “Unknown network” on asset cards: a custom chain was not added back to the network metadata. Fixed.
- Subgraph `_meta.block` only moves on blocks with events, so it can look stalled. Read the graph-node logs instead.
- Tenderly's public RPC answered 429 to the CLI; `https://ethereum-sepolia-rpc.publicnode.com` worked.
- The portal's server-side rendering breaks on Node 25 (`localStorage.getItem is not a function`). Use Node 22.
- mdx blocks outbound UDP, so cloudflared's QUIC fails (error 1033). Use `--protocol http2`.
- Carbon-choice prototype: right after creating a scheme, the ledger can show the previous scheme's rows under the new header for a few seconds, then corrects itself. Seen once in the real-MetaMask check of 2026-10-05; switching schemes from the dropdown is not affected. Cause is in the Clio-X page (stale ledger state), not on chain.
