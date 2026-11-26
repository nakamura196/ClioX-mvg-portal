# Local patches to Ocean Node 4.2.0

Files here are mounted read-only over the image's `dist/` (see `docker-compose.yml`).
Check each one again when the image version changes.

## validateOrders.js

Upstream `dist/components/core/utils/validateOrders.js` takes the transaction's
destination (`txReceipt.to`) as the datatoken. A MetaMask smart account
(EIP-7702) sends the order through its delegator contract
(`0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` on Sepolia), so the node calls
`getERC721Address()` on that contract, it reverts, and the download fails with
`CALL_EXCEPTION`.

The patch uses the datatoken address from the DDO when that contract emitted
logs in the transaction, and reads `OrderStarted` / `OrderReused` only from the
datatoken's own logs (upstream accepts these events from any contract in the
transaction).

Tested on 2026-11-25 inside the container against two real orders
(`0x9c6b65a8…d1a7`, `0x61796ba5…26f9`): upstream throws, the patch answers
"Transaction is valid.", and a wrong user is still rejected.
