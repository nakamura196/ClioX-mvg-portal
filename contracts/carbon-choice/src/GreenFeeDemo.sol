// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

    // ------------------------------------------------------------- members
    //
    // Who may receive the type 4 subsidy is chosen per scheme (its "gate"),
    // so the ways of checking eligibility can be tried side by side:
    //   0 Open      everyone (the original behaviour)
    //   1 Allowlist wallets the operator listed by hand (isMember)
    //   2 Voucher   wallets holding a short-lived voucher signed by `verifier`
    //               (id.ldas.jp checks the person off-chain; this contract
    //               only checks the signature)
    // Surcharge and discount (type 3) are not affected by the gate.
    // No name or ORCID iD ever reaches the chain, only wallet addresses.

    uint8 public constant GATE_OPEN = 0;
    uint8 public constant GATE_ALLOWLIST = 1;
    uint8 public constant GATE_VOUCHER = 2;

    address public verifier; // address whose signature makes a voucher valid
    mapping(address => bool) public isMember; // operator-managed allowlist
    address[] private _members;
    mapping(address => bool) private _everListed;
    mapping(uint256 => uint8) public gate; // scheme id => gate
    mapping(uint256 => bool) public memberPayment; // payment id => subsidy gate was passed

    event VerifierSet(address verifier);
    event MemberSet(address indexed wallet, bool member);
    event GateSet(uint256 indexed schemeId, uint8 gate);
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
    }

    Scheme[] private _schemes; // id = index + 1
    Payment[] private _payments; // id = index + 1
    mapping(uint256 => uint256[]) private _paymentsOf; // scheme id => payment ids

    event SchemeCreated(uint256 indexed schemeId, address indexed owner, string label);
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
    error BadVoucher();

    constructor() {
        operator = msg.sender;
    }

    function setVerifier(address v) external {
        if (msg.sender != operator) revert NotOperator();
        verifier = v;
        emit VerifierSet(v);
    }

    function setGate(uint256 schemeId, uint8 g) external {
        Scheme storage s = _scheme(schemeId);
        if (msg.sender != s.owner) revert NotSchemeOwner();
        if (g > GATE_VOUCHER) revert BadInput();
        gate[schemeId] = g;
        emit GateSet(schemeId, g);
    }

    function setMember(address wallet, bool member) external {
        if (msg.sender != operator) revert NotOperator();
        isMember[wallet] = member;
        if (!_everListed[wallet]) {
            _everListed[wallet] = true;
            _members.push(wallet);
        }
        emit MemberSet(wallet, member);
    }

    /// @notice Wallets currently on the allowlist.
    function members() external view returns (address[] memory out) {
        uint256 n;
        for (uint256 i; i < _members.length; i++) if (isMember[_members[i]]) n++;
        out = new address[](n);
        n = 0;
        for (uint256 i; i < _members.length; i++) if (isMember[_members[i]]) out[n++] = _members[i];
    }

    /// @notice The message the verifier signs (EIP-191 personal_sign over this hash).
    function voucherHash(address holder, uint64 expiry) public view returns (bytes32) {
        return keccak256(abi.encodePacked("clio-x member", block.chainid, address(this), holder, expiry));
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

    function createScheme(string calldata label, Rules calldata rules) external returns (uint256 id) {
        _checkRules(rules);
        if (bytes(label).length > 80) revert BadInput();
        Scheme storage s = _schemes.push();
        s.owner = msg.sender;
        s.label = label;
        s.rules = rules;
        id = _schemes.length;
        emit SchemeCreated(id, msg.sender, label);
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

    /// @notice Quote for a payer who has not passed the scheme's gate.
    function quote(uint256 schemeId, string calldata key, uint32 durationSeconds)
        public
        view
        returns (Quote memory)
    {
        return _quote(schemeId, key, durationSeconds, false);
    }

    /// @notice Quote for a payer who has passed the scheme's gate.
    function quoteMember(uint256 schemeId, string calldata key, uint32 durationSeconds)
        public
        view
        returns (Quote memory)
    {
        return _quote(schemeId, key, durationSeconds, true);
    }

    /// @notice Quote for `payer` using only what the chain knows: the allowlist.
    ///         A voucher cannot be seen from a view call; use quoteMember for it.
    function quoteFor(address payer, uint256 schemeId, string calldata key, uint32 durationSeconds)
        external
        view
        returns (Quote memory)
    {
        return _quote(schemeId, key, durationSeconds, gate[schemeId] == GATE_ALLOWLIST && isMember[payer]);
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
    ///         the list price; the payer pays the quote.
    function pay(uint256 schemeId, string calldata key, uint32 durationSeconds, bytes32 ref)
        external
        returns (uint256 paymentId)
    {
        return _pay(schemeId, key, durationSeconds, ref, gate[schemeId] == GATE_ALLOWLIST && isMember[msg.sender]);
    }

    /// @notice Same as pay, with a voucher from the verifier for msg.sender.
    ///         The voucher is valid until `expiry` (unix seconds).
    function payMember(
        uint256 schemeId,
        string calldata key,
        uint32 durationSeconds,
        bytes32 ref,
        uint64 expiry,
        bytes calldata signature
    ) external returns (uint256 paymentId) {
        _checkVoucher(expiry, signature);
        // A voucher only counts in a scheme that uses the voucher gate.
        return _pay(schemeId, key, durationSeconds, ref, _isVoucherScheme(schemeId));
    }

    function _pay(uint256 schemeId, string calldata key, uint32 durationSeconds, bytes32 ref, bool member)
        private
        returns (uint256 paymentId)
    {
        if (durationSeconds == 0) revert BadInput();
        Quote memory q = _quote(schemeId, key, durationSeconds, member);
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
                locationKey: key
            })
        );
        paymentId = _payments.length;
        if (member) memberPayment[paymentId] = true;
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

    function _checkVoucher(uint64 expiry, bytes calldata signature) private view {
        if (verifier == address(0) || block.timestamp > expiry) revert BadVoucher();
        if (_recover(voucherHash(msg.sender, expiry), signature) != verifier) revert BadVoucher();
    }

    function _isVoucherScheme(uint256 schemeId) private view returns (bool) {
        return gate[schemeId] == GATE_VOUCHER;
    }

    function _recover(bytes32 hash, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r = bytes32(sig[0:32]);
        bytes32 sv = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        if (v < 27) v += 27;
        // reject malleable (high-s) signatures
        if (uint256(sv) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) return address(0);
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        return ecrecover(digest, v, r, sv);
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
