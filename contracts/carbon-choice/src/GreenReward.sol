// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GreenReward
/// @notice Pays a reward in a test token (PLAY on Sepolia) to the owner of a real,
///         finished compute job that ran at a lower-carbon environment than the
///         highest one on the same node. Prototype for the Clio-X trial, 2026-11-27.
///
///         A checker (the portal's Worker) reads the job from the Ocean Node
///         (owner, environment, run time, vCPUs), estimates the job's carbon at every
///         real environment of the node, and signs:
///           jobIdHash, recipient (= job owner from the node), chosen and highest
///           environment keys and their estimates (micrograms CO2e), expiry.
///         Anyone may submit the signed claim; the reward always goes to the job owner.
///         One claim per job. Reward = (highestUg - chosenUg) * unitsPerMg / 1000,
///         capped per job. Rate, cap, token and checker can be changed by the owner,
///         so the reward rule can change without a new contract.
///
///         Not a measurement of emissions avoided: the figures are estimates (and, on
///         the trial site, dummy values). The event keeps them so anyone can recheck.
interface IERC20Min {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

contract GreenReward {
    address public owner;
    address public checker;
    IERC20Min public token;
    /// token units per milligram of the estimated difference (PLAY has 6 decimals)
    uint256 public unitsPerMg;
    /// maximum token units for one job
    uint256 public capPerJob;

    /// keccak256("clio-x-green-reward/1"); every word of the digest is 32 bytes
    bytes32 public constant TAG = keccak256("clio-x-green-reward/1");

    mapping(bytes32 => bool) public claimed;
    uint256 public claimCount;
    /// total token units paid (or imported) to each recipient, and how many jobs
    mapping(address => uint256) public received;
    mapping(address => uint256) public receivedCount;

    event Claimed(
        bytes32 indexed jobIdHash,
        address indexed recipient,
        string chosenKey,
        string highestKey,
        uint64 chosenUg,
        uint64 highestUg,
        uint256 amount
    );
    event Configured(address checker, address token, uint256 unitsPerMg, uint256 capPerJob);
    event OwnerChanged(address owner);
    /// history carried over from an earlier contract (no transfer happens)
    event Imported(bytes32 indexed jobIdHash, address indexed recipient, uint256 amount);

    error NotOwner();
    error AlreadyClaimed();
    error Expired();
    error BadSignature();
    error NothingToReward();
    error PoolEmpty();
    error ZeroAddress();
    error LengthMismatch();

    constructor(address checker_, address token_, uint256 unitsPerMg_, uint256 capPerJob_) {
        owner = msg.sender;
        _configure(checker_, token_, unitsPerMg_, capPerJob_);
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function configure(address checker_, address token_, uint256 unitsPerMg_, uint256 capPerJob_)
        external
        onlyOwner
    {
        _configure(checker_, token_, unitsPerMg_, capPerJob_);
    }

    function setOwner(address owner_) external onlyOwner {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        emit OwnerChanged(owner_);
    }

    /// Owner takes back unused tokens (e.g. when the rule changes).
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "transfer");
    }

    /// Owner carries over claims paid by an earlier contract: marks the jobs as
    /// claimed (so they cannot be claimed again here) and adds to the totals.
    /// No tokens move.
    function importClaimed(
        bytes32[] calldata jobIdHashes,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner {
        uint256 n = jobIdHashes.length;
        if (recipients.length != n || amounts.length != n) revert LengthMismatch();
        for (uint256 i = 0; i < n; i++) {
            bytes32 j = jobIdHashes[i];
            if (claimed[j]) revert AlreadyClaimed();
            address to = recipients[i];
            if (to == address(0)) revert ZeroAddress();
            claimed[j] = true;
            claimCount++;
            received[to] += amounts[i];
            receivedCount[to]++;
            emit Imported(j, to, amounts[i]);
        }
    }

    /// What the checker signs (EIP-191 personal_sign over this 32-byte digest).
    function digest(
        bytes32 jobIdHash,
        address recipient,
        string calldata chosenKey,
        string calldata highestKey,
        uint64 chosenUg,
        uint64 highestUg,
        uint64 expiry
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                TAG,
                block.chainid,
                address(this),
                jobIdHash,
                recipient,
                keccak256(bytes(chosenKey)),
                keccak256(bytes(highestKey)),
                chosenUg,
                highestUg,
                expiry
            )
        );
    }

    function rewardFor(uint64 chosenUg, uint64 highestUg) public view returns (uint256) {
        if (highestUg <= chosenUg) return 0;
        uint256 r = (uint256(highestUg - chosenUg) * unitsPerMg) / 1000;
        return r > capPerJob ? capPerJob : r;
    }

    function claim(
        bytes32 jobIdHash,
        address recipient,
        string calldata chosenKey,
        string calldata highestKey,
        uint64 chosenUg,
        uint64 highestUg,
        uint64 expiry,
        bytes calldata signature
    ) external returns (uint256 amount) {
        if (claimed[jobIdHash]) revert AlreadyClaimed();
        if (block.timestamp > expiry) revert Expired();
        bytes32 d = digest(jobIdHash, recipient, chosenKey, highestKey, chosenUg, highestUg, expiry);
        address signer = _recover(d, signature);
        if (signer == address(0) || signer != checker) revert BadSignature();
        amount = rewardFor(chosenUg, highestUg);
        if (amount == 0) revert NothingToReward();
        if (token.balanceOf(address(this)) < amount) revert PoolEmpty();
        claimed[jobIdHash] = true;
        claimCount++;
        received[recipient] += amount;
        receivedCount[recipient]++;
        require(token.transfer(recipient, amount), "transfer");
        emit Claimed(jobIdHash, recipient, chosenKey, highestKey, chosenUg, highestUg, amount);
    }

    function _configure(address checker_, address token_, uint256 unitsPerMg_, uint256 capPerJob_) private {
        if (checker_ == address(0) || token_ == address(0)) revert ZeroAddress();
        checker = checker_;
        token = IERC20Min(token_);
        unitsPerMg = unitsPerMg_;
        capPerJob = capPerJob_;
        emit Configured(checker_, token_, unitsPerMg_, capPerJob_);
    }

    function _recover(bytes32 d, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        // reject malleable (high-s) signatures
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        bytes32 h = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", d));
        return ecrecover(h, v, r, s);
    }
}
