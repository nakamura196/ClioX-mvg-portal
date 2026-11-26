// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Clio-X carbon choice record (prototype)
/// @notice A non-transferable token (ERC-721 + ERC-5192 "locked") that records
///         that its holder chose where to run an analysis, and what the portal
///         estimated for the options at that moment.
///
/// What this contract guarantees, and what it does not:
///   - It guarantees WHO made the claim (the minter, who is also the holder)
///     and WHEN, and that the claim has not changed since.
///   - It does NOT verify the numbers. Emissions are the portal's estimate from
///     published grid factors and power profiles; the holder submits them.
///     The token is an attributable claim, not a certified reduction, and it
///     cannot be sold or transferred.
///   - The full record (sources, quality labels of every option) lives off
///     chain as JSON; only its SHA-256 is stored here.
contract CarbonChoiceRecord {
    struct Record {
        bytes32 recordHash; // SHA-256 of the off-chain JSON record
        uint64 chosenMgCO2e; // estimate for the chosen location, in mgCO2e
        uint64 highestMgCO2e; // highest estimate among the comparable options
        uint32 alternatives; // number of options whose emissions could be estimated
        uint8 quality; // weakest data quality: 0 measured, 1 provider-reported, 2 portal-estimated
        uint40 issuedAt; // block timestamp
        string locationKey; // registry key of the chosen location, e.g. "eu-north-1"
    }

    string public constant name = "Clio-X Carbon Choice Record";
    string public constant symbol = "CXCC";

    uint256 public totalSupply;
    mapping(uint256 => Record) private _records;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256[]) private _tokensOf;

    // ERC-721
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    // ERC-5192: emitted once at mint; the token stays locked forever.
    event Locked(uint256 tokenId);
    event ChoiceRecorded(
        uint256 indexed tokenId,
        address indexed holder,
        bytes32 indexed recordHash,
        string locationKey,
        uint64 chosenMgCO2e,
        uint64 highestMgCO2e
    );

    error Soulbound();
    error NotMinted();
    error BadInput();

    /// @notice Record your own choice. The token is minted to the caller.
    function record(
        bytes32 recordHash,
        string calldata locationKey,
        uint64 chosenMgCO2e,
        uint64 highestMgCO2e,
        uint32 alternatives,
        uint8 quality
    ) external returns (uint256 tokenId) {
        if (recordHash == bytes32(0)) revert BadInput();
        if (chosenMgCO2e > highestMgCO2e) revert BadInput();
        if (alternatives == 0 || quality > 2) revert BadInput();
        _checkKey(locationKey);

        tokenId = ++totalSupply;
        _owners[tokenId] = msg.sender;
        _tokensOf[msg.sender].push(tokenId);
        _records[tokenId] = Record({
            recordHash: recordHash,
            chosenMgCO2e: chosenMgCO2e,
            highestMgCO2e: highestMgCO2e,
            alternatives: alternatives,
            quality: quality,
            issuedAt: uint40(block.timestamp),
            locationKey: locationKey
        });

        emit Transfer(address(0), msg.sender, tokenId);
        emit Locked(tokenId);
        emit ChoiceRecorded(tokenId, msg.sender, recordHash, locationKey, chosenMgCO2e, highestMgCO2e);
    }

    function getRecord(uint256 tokenId) external view returns (Record memory) {
        if (_owners[tokenId] == address(0)) revert NotMinted();
        return _records[tokenId];
    }

    function tokensOf(address holder) external view returns (uint256[] memory) {
        return _tokensOf[holder];
    }

    // ---- ERC-721 read side ----

    function balanceOf(address holder) external view returns (uint256) {
        return _tokensOf[holder].length;
    }

    function ownerOf(uint256 tokenId) public view returns (address owner) {
        owner = _owners[tokenId];
        if (owner == address(0)) revert NotMinted();
    }

    /// @notice ERC-5192: every token is locked.
    function locked(uint256 tokenId) external view returns (bool) {
        ownerOf(tokenId);
        return true;
    }

    function getApproved(uint256 tokenId) external view returns (address) {
        ownerOf(tokenId);
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    /// @notice Metadata as a data: URI, so wallets can show it without a server.
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ownerOf(tokenId);
        Record storage r = _records[tokenId];
        return string.concat(
            "data:application/json;utf8,{\"name\":\"Carbon choice #",
            _u(tokenId),
            "\",\"description\":\"An attributable claim recorded by its holder: the analysis was planned to run at the chosen location. Figures are the portal's estimates, not verified or certified reductions. Non-transferable.\",\"attributes\":[",
            _attr("location", r.locationKey, true),
            ",",
            _attr("chosen_mgCO2e", _u(r.chosenMgCO2e), false),
            ",",
            _attr("highest_mgCO2e", _u(r.highestMgCO2e), false),
            ",",
            _attr("options_compared", _u(r.alternatives), false),
            ",",
            _attr("quality", _quality(r.quality), true),
            ",",
            _attr("record_sha256", _hex(r.recordHash), true),
            "]}"
        );
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == 0x01ffc9a7 // ERC-165
            || id == 0x80ac58cd // ERC-721
            || id == 0x5b5e139f // ERC-721 metadata
            || id == 0xb45a3c0e; // ERC-5192
    }

    // ---- ERC-721 write side: all disabled ----

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    // ---- helpers ----

    /// Keys are registry keys ("eu-north-1", "mdx"): 1–32 chars of a-z, 0-9, "-".
    /// Restricting them keeps tokenURI valid JSON without escaping.
    function _checkKey(string calldata key) private pure {
        bytes calldata b = bytes(key);
        if (b.length == 0 || b.length > 32) revert BadInput();
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            bool ok = (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c == "-";
            if (!ok) revert BadInput();
        }
    }

    function _attr(string memory k, string memory v, bool quoted) private pure returns (string memory) {
        return string.concat(
            "{\"trait_type\":\"", k, "\",\"value\":", quoted ? "\"" : "", v, quoted ? "\"" : "", "}"
        );
    }

    function _quality(uint8 q) private pure returns (string memory) {
        if (q == 0) return "measured";
        if (q == 1) return "provider-reported";
        return "portal-estimated";
    }

    function _u(uint256 v) private pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) ++len;
        bytes memory s = new bytes(len);
        for (; v != 0; v /= 10) s[--len] = bytes1(uint8(48 + (v % 10)));
        return string(s);
    }

    function _hex(bytes32 h) private pure returns (string memory) {
        bytes memory digits = "0123456789abcdef";
        bytes memory s = new bytes(64);
        for (uint256 i; i < 32; ++i) {
            s[2 * i] = digits[uint8(h[i]) >> 4];
            s[2 * i + 1] = digits[uint8(h[i]) & 0x0f];
        }
        return string(s);
    }
}
