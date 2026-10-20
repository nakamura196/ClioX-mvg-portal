// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The part of the Ethereum Attestation Service (EAS) this contract reads.
///         Same struct and function as EAS v0.26 (Sepolia 0xC2679fBD...815e).
struct Attestation {
    bytes32 uid;
    bytes32 schema;
    uint64 time;
    uint64 expirationTime;
    uint64 revocationTime;
    bytes32 refUID;
    address recipient;
    address attester;
    bool revocable;
    bytes data;
}

interface IEAS {
    function getAttestation(bytes32 uid) external view returns (Attestation memory);
}

/// @title Clio-X green fee demo (prototype, play money)
/// @notice Makes low-emission compute locations cheaper, in two ways that are
///         described on cliox-docs.ldas.jp/project/green-choice:
///
///   Type 3, feebate (France's bonus-malus): a scheme adds a surcharge to
///   high-emission locations and pays a discount to low-emission ones. The
///   surcharges go into the scheme's pool and the discounts come out of it.
///   No outside money: a discount is paid only while the pool has funds.
///
///   Type 4, sponsor deposit (Japan's eco-points 2009-2011): anyone deposits
///   money into a scheme. When a payer picks a low-emission location, the
///   deposit pays a share of the price, up to a cap per job. Every payout is
///   stored here, so a sponsor can show where its money went.
///
/// In every payment the provider receives its full list price. Only the
/// payer's share changes. The money is PLAY, a token with a free faucet and no
/// value. Prices and emissions are the portal's per-hour estimates, registered
/// by the operator; this contract does not verify them.
contract GreenFeeDemo {
    // ---------------------------------------------------------------- PLAY

    string public constant name = "Clio-X Play Dollar";
    string public constant symbol = "PLAY";
    uint8 public constant decimals = 6;
    uint256 public constant FAUCET_TOP_UP = 1_000e6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ----------------------------------------------------------- locations

    struct Location {
        address provider; // receives the list price (a demo address in this prototype)
        uint64 microPerHour; // list price, PLAY micro-units per hour
        uint64 mgPerHour; // portal's emission estimate, mgCO2e per hour
        bool active;
    }

    address public immutable operator;

    // ---------------------------------------------------------------- gate
    //
    // Who may receive the type 4 subsidy is chosen per scheme when it is
    // created, and cannot be changed afterwards:
    //   0 Open  everyone (the original behaviour)
    //   1 EAS   wallets that hold an attestation written by `memberAttester`
    //           (the operator) under `memberSchema`, checked on the chain
    // A payer on an EAS scheme who has no attestation can still pay, without
    // the subsidy. Surcharge and discount (type 3) are not affected.
    // No name or ORCID iD reaches the chain. The schema holds one bool.

    uint8 public constant GATE_OPEN = 0;
    uint8 public constant GATE_EAS = 1;

    // Reasons returned by isMember (0 = ok).
    uint8 public constant R_OK = 0;
    uint8 public constant R_NO_UID = 1; // no attestation id was given
    uint8 public constant R_STOPPED = 2; // EAS, schema or attester not set (emergency stop)
    uint8 public constant R_NOT_FOUND = 3; // EAS has no such attestation, or cannot be read
    uint8 public constant R_WRONG_SCHEMA = 4;
    uint8 public constant R_WRONG_ATTESTER = 5;
    uint8 public constant R_OTHER_RECIPIENT = 6;
    uint8 public constant R_REVOKED = 7;
    uint8 public constant R_EXPIRED = 8;

    IEAS public eas;
    bytes32 public memberSchema;
    address public memberAttester; // address(0) = emergency stop

    mapping(uint256 => uint8) public gate; // scheme id => gate, fixed at creation

    event EasConfigured(address eas, bytes32 schema);
    event AttesterSet(address attester);
    mapping(string => Location) public locations;
    string[] private _locationKeys;

    event LocationSet(string key, address provider, uint64 microPerHour, uint64 mgPerHour);

    // ------------------------------------------------------------- schemes

    struct Rules {
        uint16 surchargeBps; // type 3: added to high-emission locations
        uint16 discountBps; // type 3: taken off low-emission locations, paid from the pool
        uint64 lowUpToMgPerHour; // at or below: low-emission (discount, subsidy)
        uint64 highFromMgPerHour; // at or above: high-emission (surcharge)
        uint16 subsidyBps; // type 4: share of the price paid from the deposit
        uint64 subsidyCapMicro; // type 4: at most this much per job
    }

    struct Scheme {
        address owner;
        string label;
        Rules rules;
        uint256 pool; // type 3 funds: surcharges in, discounts out
        uint256 deposit; // type 4 funds: deposits in, subsidies out
        uint256 surchargesIn;
        uint256 discountsOut;
        uint256 depositsIn;
        uint256 subsidiesOut;
        uint256 withdrawn;
        uint32 payments;
    }

    struct Quote {
        uint256 base; // provider's list price
        uint256 surcharge;
        uint256 discount; // what the pool actually pays (may be less than the rule)
        uint256 discountWanted; // what the rule asks for
        uint256 subsidy;
        uint256 payerPays;
        uint64 mgCO2e;
        uint8 band; // 0 low, 1 middle, 2 high
    }

    struct Payment {
        uint32 schemeId;
        address payer;
        uint40 paidAt;
        uint64 blockNumber;
        uint32 durationSeconds;
        uint64 mgCO2e;
        uint8 band;
        uint256 base;
        uint256 surcharge;
        uint256 discount;
        uint256 subsidy;
        uint256 payerPays;
        bytes32 ref; // e.g. the SHA-256 of a carbon-choice record; may be zero
        string locationKey;
        uint8 basis; // why a gated subsidy was allowed: 0 none (or open scheme), 1 EAS attestation
        bytes32 attestation; // the EAS attestation id used, or zero
    }

    Scheme[] private _schemes; // id = index + 1
    Payment[] private _payments; // id = index + 1
    mapping(uint256 => uint256[]) private _paymentsOf; // scheme id => payment ids

    event SchemeCreated(uint256 indexed schemeId, address indexed owner, string label, uint8 gate);
    event RulesChanged(uint256 indexed schemeId, Rules rules);
    event Deposited(uint256 indexed schemeId, address indexed from, uint256 amount);
    event Withdrawn(uint256 indexed schemeId, address indexed to, uint256 amount);
    event Paid(
        uint256 indexed paymentId,
        uint256 indexed schemeId,
        address indexed payer,
        string locationKey,
        uint256 base,
        uint256 surcharge,
        uint256 discount,
        uint256 subsidy,
        uint256 payerPays
    );

    error NotOperator();
    error NotSchemeOwner();
    error NoSuchScheme();
    error NoSuchLocation();
    error BadInput();
    error InsufficientBalance();
    error InsufficientAllowance();
    error NotAnEasScheme();
    error BadAttestation(uint8 reason);
    error TooExpensive(uint256 payerPays, uint256 max);

    constructor() {
        operator = msg.sender;
    }

    /// @notice Operator only: which EAS contract and schema count as a member proof.
    function setEas(address easAddress, bytes32 schema) external {
        if (msg.sender != operator) revert NotOperator();
        eas = IEAS(easAddress);
        memberSchema = schema;
        emit EasConfigured(easAddress, schema);
    }

    /// @notice Operator only: whose attestations count. address(0) stops every
    ///         EAS scheme from paying a subsidy (emergency stop).
    function setAttester(address attester) external {
        if (msg.sender != operator) revert NotOperator();
        memberAttester = attester;
        emit AttesterSet(attester);
    }

    /// @notice The contract's own judgement of an attestation for `payer`.
    ///         The portal shows exactly this; it has no separate check.
    function isMember(address payer, bytes32 uid) public view returns (bool ok, uint8 reason) {
        if (uid == bytes32(0)) return (false, R_NO_UID);
        if (address(eas) == address(0) || memberSchema == bytes32(0) || memberAttester == address(0)) {
            return (false, R_STOPPED);
        }
        Attestation memory a;
        try eas.getAttestation(uid) returns (Attestation memory got) {
            a = got;
        } catch {
            return (false, R_NOT_FOUND);
        }
        if (a.uid != uid) return (false, R_NOT_FOUND);
        if (a.schema != memberSchema) return (false, R_WRONG_SCHEMA);
        if (a.attester != memberAttester) return (false, R_WRONG_ATTESTER);
        if (a.recipient != payer) return (false, R_OTHER_RECIPIENT);
        if (a.revocationTime != 0) return (false, R_REVOKED);
        if (a.expirationTime != 0 && a.expirationTime <= block.timestamp) return (false, R_EXPIRED);
        return (true, R_OK);
    }

    // ---------------------------------------------------------------- PLAY

    /// @notice Free play money: tops the caller up to 1,000 PLAY.
    function faucet() external {
        uint256 have = balanceOf[msg.sender];
        if (have >= FAUCET_TOP_UP) return;
        uint256 amount = FAUCET_TOP_UP - have;
        totalSupply += amount;
        balanceOf[msg.sender] = FAUCET_TOP_UP;
        emit Transfer(address(0), msg.sender, amount);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) {
            if (a < value) revert InsufficientAllowance();
            allowance[from][msg.sender] = a - value;
        }
        _transfer(from, to, value);
        return true;
    }

    // ----------------------------------------------------------- locations

    function setLocation(string calldata key, address provider, uint64 microPerHour, uint64 mgPerHour)
        external
    {
        if (msg.sender != operator) revert NotOperator();
        if (bytes(key).length == 0 || provider == address(0) || microPerHour == 0) revert BadInput();
        if (!locations[key].active) _locationKeys.push(key);
        locations[key] = Location(provider, microPerHour, mgPerHour, true);
        emit LocationSet(key, provider, microPerHour, mgPerHour);
    }

    function locationKeys() external view returns (string[] memory) {
        return _locationKeys;
    }

    // ------------------------------------------------------------- schemes

    /// @param gateKind 0 = anyone may receive the subsidy, 1 = EAS attestation.
    ///        Fixed here; there is no way to change it later.
    function createScheme(string calldata label, Rules calldata rules, uint8 gateKind)
        external
        returns (uint256 id)
    {
        _checkRules(rules);
        if (gateKind > GATE_EAS) revert BadInput();
        if (bytes(label).length > 80) revert BadInput();
        Scheme storage s = _schemes.push();
        s.owner = msg.sender;
        s.label = label;
        s.rules = rules;
        id = _schemes.length;
        gate[id] = gateKind;
        emit SchemeCreated(id, msg.sender, label, gateKind);
        emit RulesChanged(id, rules);
    }

    function setRules(uint256 schemeId, Rules calldata rules) external {
        Scheme storage s = _scheme(schemeId);
        if (msg.sender != s.owner) revert NotSchemeOwner();
        _checkRules(rules);
        s.rules = rules;
        emit RulesChanged(schemeId, rules);
    }

    /// @notice Type 4: put PLAY into a scheme's deposit. Anyone may fund any scheme.
    function deposit(uint256 schemeId, uint256 amount) external {
        Scheme storage s = _scheme(schemeId);
        if (amount == 0) revert BadInput();
        _transfer(msg.sender, address(this), amount);
        s.deposit += amount;
        s.depositsIn += amount;
        emit Deposited(schemeId, msg.sender, amount);
    }

    /// @notice The owner may take back unspent deposit. The feebate pool cannot
    ///         be withdrawn: it belongs to the payers who paid surcharges.
    function withdraw(uint256 schemeId, uint256 amount) external {
        Scheme storage s = _scheme(schemeId);
        if (msg.sender != s.owner) revert NotSchemeOwner();
        if (amount == 0 || amount > s.deposit) revert BadInput();
        s.deposit -= amount;
        s.withdrawn += amount;
        _transfer(address(this), msg.sender, amount);
        emit Withdrawn(schemeId, msg.sender, amount);
    }

    function schemeCount() external view returns (uint256) {
        return _schemes.length;
    }

    function getScheme(uint256 schemeId) external view returns (Scheme memory) {
        return _scheme(schemeId);
    }

    // ------------------------------------------------------------ payments

    /// @notice Quote for a payer with no membership proof.
    function quote(uint256 schemeId, string calldata key, uint32 durationSeconds)
        external
        view
        returns (Quote memory)
    {
        return _quote(schemeId, key, durationSeconds, false);
    }

    /// @notice Quote for `payer` holding attestation `uid` (zero = none).
    ///         It does not revert for a bad uid; it gives the unsubsidized quote.
    ///         Ask isMember for the reason. payMember reverts for a bad uid.
    function quoteFor(address payer, uint256 schemeId, string calldata key, uint32 durationSeconds, bytes32 uid)
        external
        view
        returns (Quote memory)
    {
        bool member;
        if (gate[schemeId] == GATE_EAS) (member,) = isMember(payer, uid);
        return _quote(schemeId, key, durationSeconds, member);
    }

    function _quote(uint256 schemeId, string calldata key, uint32 durationSeconds, bool member)
        private
        view
        returns (Quote memory q)
    {
        Scheme storage s = _scheme(schemeId);
        Location storage loc = locations[key];
        if (!loc.active) revert NoSuchLocation();
        Rules memory r = s.rules;

        q.base = (uint256(loc.microPerHour) * durationSeconds) / 3600;
        q.mgCO2e = uint64((uint256(loc.mgPerHour) * durationSeconds) / 3600);
        q.band = loc.mgPerHour <= r.lowUpToMgPerHour ? 0 : loc.mgPerHour >= r.highFromMgPerHour ? 2 : 1;

        if (q.band == 2) q.surcharge = (q.base * r.surchargeBps) / 10_000;
        if (q.band == 0) {
            q.discountWanted = (q.base * r.discountBps) / 10_000;
            q.discount = q.discountWanted < s.pool ? q.discountWanted : s.pool;
        }
        uint256 due = q.base + q.surcharge - q.discount;
        if (q.band == 0 && (member || gate[schemeId] == GATE_OPEN)) {
            uint256 sub = (due * r.subsidyBps) / 10_000;
            if (sub > r.subsidyCapMicro) sub = r.subsidyCapMicro;
            if (sub > s.deposit) sub = s.deposit;
            q.subsidy = sub;
        }
        q.payerPays = due - q.subsidy;
    }

    /// @notice Pay for a job at a location under a scheme. The provider gets
    ///         the list price; the payer pays the quote. On an EAS scheme this
    ///         pays without the subsidy (use payMember to claim it).
    function pay(uint256 schemeId, string calldata key, uint32 durationSeconds, bytes32 ref)
        external
        returns (uint256 paymentId)
    {
        return _pay(schemeId, key, durationSeconds, ref, false, bytes32(0), type(uint256).max);
    }

    /// @notice Same as pay, but reverts if the payer would pay more than
    ///         `maxPayerPays` (e.g. the deposit ran out after the quote).
    function payUpTo(uint256 schemeId, string calldata key, uint32 durationSeconds, bytes32 ref, uint256 maxPayerPays)
        external
        returns (uint256 paymentId)
    {
        return _pay(schemeId, key, durationSeconds, ref, false, bytes32(0), maxPayerPays);
    }

    /// @notice Pay on an EAS scheme claiming the subsidy with attestation `uid`.
    ///         Zero uid: pays the unsubsidized price. A non-zero uid that fails
    ///         the check reverts with BadAttestation(reason), so nobody is
    ///         charged the full price while believing they are a member.
    ///         Reverts on a scheme that is not an EAS scheme.
    function payMember(
        uint256 schemeId,
        string calldata key,
        uint32 durationSeconds,
        bytes32 ref,
        bytes32 uid,
        uint256 maxPayerPays
    ) external returns (uint256 paymentId) {
        _scheme(schemeId);
        if (gate[schemeId] != GATE_EAS) revert NotAnEasScheme();
        bool member;
        if (uid != bytes32(0)) {
            uint8 reason;
            (member, reason) = isMember(msg.sender, uid);
            if (!member) revert BadAttestation(reason);
        }
        return _pay(schemeId, key, durationSeconds, ref, member, uid, maxPayerPays);
    }

    function _pay(
        uint256 schemeId,
        string calldata key,
        uint32 durationSeconds,
        bytes32 ref,
        bool member,
        bytes32 uid,
        uint256 maxPayerPays
    ) private returns (uint256 paymentId) {
        if (durationSeconds == 0) revert BadInput();
        Quote memory q = _quote(schemeId, key, durationSeconds, member);
        if (q.payerPays > maxPayerPays) revert TooExpensive(q.payerPays, maxPayerPays);
        Scheme storage s = _schemes[schemeId - 1];

        _transfer(msg.sender, address(this), q.payerPays);
        s.pool = s.pool + q.surcharge - q.discount;
        s.deposit -= q.subsidy;
        s.surchargesIn += q.surcharge;
        s.discountsOut += q.discount;
        s.subsidiesOut += q.subsidy;
        s.payments += 1;
        _transfer(address(this), locations[key].provider, q.base);

        _payments.push(
            Payment({
                schemeId: uint32(schemeId),
                payer: msg.sender,
                paidAt: uint40(block.timestamp),
                blockNumber: uint64(block.number),
                durationSeconds: durationSeconds,
                mgCO2e: q.mgCO2e,
                band: q.band,
                base: q.base,
                surcharge: q.surcharge,
                discount: q.discount,
                subsidy: q.subsidy,
                payerPays: q.payerPays,
                ref: ref,
                locationKey: key,
                basis: member && q.subsidy > 0 ? 1 : 0,
                attestation: member ? uid : bytes32(0)
            })
        );
        paymentId = _payments.length;
        _paymentsOf[schemeId].push(paymentId);
        emit Paid(paymentId, schemeId, msg.sender, key, q.base, q.surcharge, q.discount, q.subsidy, q.payerPays);
    }

    function paymentCount() external view returns (uint256) {
        return _payments.length;
    }

    function getPayment(uint256 paymentId) external view returns (Payment memory) {
        if (paymentId == 0 || paymentId > _payments.length) revert BadInput();
        return _payments[paymentId - 1];
    }

    function paymentsOf(uint256 schemeId) external view returns (uint256[] memory) {
        return _paymentsOf[schemeId];
    }

    // ------------------------------------------------------------ internal

    function _scheme(uint256 schemeId) private view returns (Scheme storage) {
        if (schemeId == 0 || schemeId > _schemes.length) revert NoSuchScheme();
        return _schemes[schemeId - 1];
    }

    function _checkRules(Rules calldata r) private pure {
        if (r.surchargeBps > 10_000 || r.discountBps > 10_000 || r.subsidyBps > 10_000) revert BadInput();
        if (r.lowUpToMgPerHour >= r.highFromMgPerHour) revert BadInput();
    }

    function _transfer(address from, address to, uint256 value) private {
        if (balanceOf[from] < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] -= value;
        }
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }
}
