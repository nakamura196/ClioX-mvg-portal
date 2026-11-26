// [local patch] Ocean Node 4.2.0 dist/components/core/utils/validateOrders.js; see deploy/ocean-node/patches/README.md
import { Contract, Interface } from 'ethers';
import { fetchEventFromTransaction } from '../../../utils/util.js';
import ERC20Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC20TemplateEnterprise.sol/ERC20TemplateEnterprise.json' with { type: 'json' };
import ERC721Template from '@oceanprotocol/contracts/artifacts/contracts/templates/ERC721Template.sol/ERC721Template.json' with { type: 'json' };
import { CORE_LOGGER } from '../../../utils/logging/common.js';
import { EVENTS } from '../../../utils/index.js';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function fetchTransactionReceipt(txId, provider, retries = 2) {
    while (retries > 0) {
        try {
            const txReceipt = await provider.getTransactionReceipt(txId);
            if (txReceipt) {
                return txReceipt;
            }
            if (retries > 1) {
                await sleep(1000);
            }
            retries--;
        }
        catch (error) {
            const errorMsg = `Error fetching transaction receipt: ${error}`;
            CORE_LOGGER.logMessage(errorMsg);
            return null;
        }
    }
}
export async function validateOrderTransaction(txId, userAddress, provider, dataNftAddress, datatokenAddress, serviceIndex, serviceTimeout, signer) {
    const contractInterface = new Interface(ERC20Template.abi);
    let txReceiptMined = await fetchTransactionReceipt(txId, provider);
    if (!txReceiptMined) {
        const errorMsg = `Tx receipt cannot be processed, because tx id ${txId} was not mined.`;
        CORE_LOGGER.logMessage(errorMsg);
        return {
            isValid: false,
            message: errorMsg
        };
    }
    // [local patch] A smart account (EIP-7702, MetaMask's delegator
    // 0xdb9B…) sends the order through a relay contract, so tx.to is not the
    // datatoken and getERC721Address() reverts. Use the datatoken from the DDO
    // when it emitted logs in this transaction, and read only its own events.
    let erc20Address = txReceiptMined.to;
    if (datatokenAddress &&
        erc20Address?.toLowerCase() !== datatokenAddress.toLowerCase() &&
        txReceiptMined.logs?.some((l) => l.address?.toLowerCase() === datatokenAddress.toLowerCase())) {
        CORE_LOGGER.logMessage(`validateOrders: tx ${txId} was sent to ${erc20Address}; using datatoken ${datatokenAddress} from its logs.`);
        erc20Address = datatokenAddress;
    }
    const onlyFrom = (receipt) => ({
        ...receipt,
        logs: receipt.logs.filter((l) => l.address?.toLowerCase() === erc20Address?.toLowerCase())
    });
    const datatokenContract = new Contract(erc20Address, ERC20Template.abi, signer);
    const erc721Address = await datatokenContract.getERC721Address();
    const orderReusedEvent = fetchEventFromTransaction(onlyFrom(txReceiptMined), EVENTS.ORDER_REUSED, contractInterface);
    if (orderReusedEvent && orderReusedEvent?.length > 0) {
        const reusedTxId = orderReusedEvent[0].args[0];
        txReceiptMined = await fetchTransactionReceipt(reusedTxId, provider);
        if (!txReceiptMined) {
            const errorMsg = `Tx receipt cannot be processed, because tx id ${txId} was not mined.`;
            CORE_LOGGER.logMessage(errorMsg);
            return {
                isValid: false,
                message: errorMsg
            };
        }
    }
    const OrderStartedEvent = fetchEventFromTransaction(onlyFrom(txReceiptMined), EVENTS.ORDER_STARTED, contractInterface);
    let orderEvent;
    for (const event of OrderStartedEvent ?? []) {
        if ((userAddress?.toLowerCase() === event.args[0]?.toLowerCase() ||
            userAddress?.toLowerCase() === event.args[1]?.toLowerCase()) &&
            erc20Address?.toLowerCase() === datatokenAddress?.toLowerCase() &&
            erc721Address?.toLowerCase() === dataNftAddress?.toLowerCase()) {
            orderEvent = event;
            break;
        }
    }
    if (!orderEvent) {
        return {
            isValid: false,
            message: 'Tx id used not valid, one of the NFT addresses, Datatoken address or the User address contract address does not match.'
        };
    }
    const eventServiceIndex = orderEvent.args[3];
    if (BigInt(serviceIndex) !== eventServiceIndex) {
        return {
            isValid: false,
            message: 'Invalid service index.'
        };
    }
    const ERC721Contract = new Contract(dataNftAddress, ERC721Template.abi, provider);
    const isDatatokenDeployed = await ERC721Contract.isDeployed(datatokenAddress);
    if (!isDatatokenDeployed) {
        return {
            isValid: false,
            message: 'Datatoken was not deployed by this DataNFT.'
        };
    }
    const eventTimestamp = (await provider.getBlock(txReceiptMined.blockHash)).timestamp;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const timeElapsed = currentTimestamp - eventTimestamp;
    CORE_LOGGER.logMessage(`serviceTimeout ${serviceTimeout} vs. timeElapsed ${timeElapsed} when validating order.`);
    if (serviceTimeout !== 0 && timeElapsed > serviceTimeout) {
        return {
            isValid: false,
            message: 'The order has expired.'
        };
    }
    return {
        isValid: true,
        message: 'Transaction is valid.'
    };
}
//# sourceMappingURL=validateOrders.js.map