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

## Assets published with the CLI show a broken thumbnail

**Where:** `@oceanprotocol/lib` 9.2.1 (used by `ocean-cli` 2.1.0) and the portal. **Status:** fixed in the portal (commit `f0307b02` on `deploy/hosting`).

`createAsset()` in ocean.js mints the data NFT with the fixed `tokenURI` `"aaa"`.
The portal treated any non-`data:` tokenURI as an image address, so it rendered `<img src="aaa">`.
The image failed, and the NFT name (the alt text) spilled out of the 60 px box at the top of the asset page.
The portal now uses only values that start with `data:image/`, `http(s)://` or `/`, and falls back to the Clio-X logo when the image fails to load.
The on-chain value stays `"aaa"`; it cannot be changed without a transaction from the NFT owner.

## Smaller things

- Sepolia showed as “Unknown network” on asset cards: a custom chain was not added back to the network metadata. Fixed.
- Subgraph `_meta.block` only moves on blocks with events, so it can look stalled. Read the graph-node logs instead.
- Tenderly's public RPC answered 429 to the CLI; `https://ethereum-sepolia-rpc.publicnode.com` worked.
- The portal's server-side rendering breaks on Node 25 (`localStorage.getItem is not a function`). Use Node 22.
- mdx blocks outbound UDP, so cloudflared's QUIC fails (error 1033). Use `--protocol http2`.
