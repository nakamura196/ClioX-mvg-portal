// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

interface ISchemaRegistry {
    function register(string calldata schema, address resolver, bool revocable) external returns (bytes32);
}

struct AttestationRequestData {
    address recipient;
    uint64 expirationTime;
    bool revocable;
    bytes32 refUID;
    bytes data;
    uint256 value;
}

struct AttestationRequest {
    bytes32 schema;
    AttestationRequestData data;
}

struct RevocationRequestData {
    bytes32 uid;
    uint256 value;
}

struct RevocationRequest {
    bytes32 schema;
    RevocationRequestData data;
}

interface IEASWrite {
    function attest(AttestationRequest calldata request) external payable returns (bytes32);
    function revoke(RevocationRequest calldata request) external payable;
}

/// Operator scripts for the member attestations (Sepolia). NOT run by any test.
/// The key comes from the environment (see eas-member.zsh); nothing is written to disk.
///
///   register  one time: registers the schema "bool member" (no resolver, revocable)
///   attest    MEMBER=<wallet>: writes "this wallet is a member" for that wallet
///   revoke    ATTESTATION_UID=<attestation id>: revokes it (the subsidy stops at once)
///
/// Run one with --sig, e.g.
///   forge script script/EasMember.s.sol:EasMember --sig 'attest()' --rpc-url ... --broadcast
contract EasMember is Script {
    address constant SEPOLIA_EAS = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;
    address constant SEPOLIA_REGISTRY = 0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0;
    string constant SCHEMA = "bool member";

    function schemaUid() public pure returns (bytes32) {
        return keccak256(abi.encodePacked(SCHEMA, address(0), true));
    }

    function register() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        bytes32 uid = ISchemaRegistry(SEPOLIA_REGISTRY).register(SCHEMA, address(0), true);
        vm.stopBroadcast();
        console.log("schema uid");
        console.logBytes32(uid);
        require(uid == schemaUid(), "unexpected schema uid");
    }

    function attest() external {
        address member = vm.envAddress("MEMBER");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        bytes32 uid = IEASWrite(SEPOLIA_EAS)
            .attest(
                AttestationRequest({
                schema: schemaUid(),
                data: AttestationRequestData({
                recipient: member,
                expirationTime: 0,
                revocable: true,
                refUID: bytes32(0),
                data: abi.encode(true),
                value: 0
            })
            })
            );
        vm.stopBroadcast();
        console.log("attested", member);
        console.logBytes32(uid);
    }

    function revoke() external {
        bytes32 uid = vm.envBytes32("ATTESTATION_UID");
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        IEASWrite(SEPOLIA_EAS)
            .revoke(RevocationRequest({schema: schemaUid(), data: RevocationRequestData({uid: uid, value: 0})}));
        vm.stopBroadcast();
        console.log("revoked");
        console.logBytes32(uid);
    }
}
