// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GreenFeeDemo, IEAS, Attestation} from "../src/GreenFeeDemo.sol";

/// Behaves like EAS for the one function the demo reads: an unknown uid
/// returns an all-zero struct (it does not revert).
contract MockEAS {
    mapping(bytes32 => Attestation) public store;

    function put(Attestation memory a) external {
        store[a.uid] = a;
    }

    function revoke(bytes32 uid) external {
        store[uid].revocationTime = uint64(block.timestamp);
    }

    function getAttestation(bytes32 uid) external view returns (Attestation memory) {
        return store[uid];
    }
}

contract GreenFeeEasTest is Test {
    GreenFeeDemo g;
    MockEAS eas;
    address provLow = address(0x1001);
    address provHigh = address(0x1002);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address sponsor = address(0x5905);
    address attester = address(0xA77E57);
    uint32 constant HOURS_20 = 20 * 3600;
    bytes32 constant UID = keccak256("alice-member");
    bytes32 schema;
    uint256 open; // gate 0 scheme
    uint256 gated; // gate 1 scheme

    function setUp() public {
        g = new GreenFeeDemo();
        eas = new MockEAS();
        schema = keccak256(abi.encodePacked("bool member", address(0), true));
        g.setLocation("low", provLow, 558_000, 590);
        g.setLocation("high", provHigh, 1_167_200, 30_888);
        g.setEas(address(eas), schema);
        g.setAttester(attester);
        GreenFeeDemo.Rules memory r = GreenFeeDemo.Rules({
            surchargeBps: 0,
            discountBps: 0,
            lowUpToMgPerHour: 5_000,
            highFromMgPerHour: 20_000,
            subsidyBps: 5_000,
            subsidyCapMicro: 5e6
        });
        open = g.createScheme("open", r, 0);
        gated = g.createScheme("gated", r, 1);
        vm.prank(sponsor);
        g.faucet();
        vm.startPrank(sponsor);
        g.deposit(open, 100e6);
        g.deposit(gated, 100e6);
        vm.stopPrank();
        vm.prank(alice);
        g.faucet();
        vm.prank(bob);
        g.faucet();
        _attest(UID, schema, attester, alice, 0);
    }

    function _attest(bytes32 uid, bytes32 sch, address by, address to, uint64 exp) internal {
        eas.put(
            Attestation({
                uid: uid,
                schema: sch,
                time: uint64(block.timestamp),
                expirationTime: exp,
                revocationTime: 0,
                refUID: bytes32(0),
                recipient: to,
                attester: by,
                revocable: true,
                data: abi.encode(true)
            })
        );
    }

    // base price 20 h of "low" = 11.16 PLAY; 50 % subsidy would be 5.58 but the cap is 5.
    uint256 constant FULL = 11_160_000;
    uint256 constant SUBSIDISED = 11_160_000 - 5_000_000;

    function test_schemaUid() public pure {
        // The value to register on Sepolia: schema "bool member", no resolver, revocable.
        bytes32 uid = keccak256(abi.encodePacked("bool member", address(0), true));
        assertEq(uid, 0x751f5a7e7ba19e6c1db68b77340edd298fc144a39070afc766a9320ffe80130d);
    }

    function test_memberGetsSubsidy() public {
        (bool ok, uint8 why) = g.isMember(alice, UID);
        assertTrue(ok);
        assertEq(why, 0);
        assertEq(g.quoteFor(alice, gated, "low", HOURS_20, UID).payerPays, SUBSIDISED);
        vm.prank(alice);
        uint256 pid = g.payMember(gated, "low", HOURS_20, bytes32(0), UID, SUBSIDISED);
        assertEq(g.balanceOf(alice), 1_000e6 - SUBSIDISED);
        assertEq(g.balanceOf(provLow), FULL);
        assertEq(g.getScheme(gated).deposit, 95e6);
        GreenFeeDemo.Payment memory p = g.getPayment(pid);
        assertEq(p.subsidy, 5_000_000);
        assertEq(p.payerPays, SUBSIDISED);
        assertEq(p.basis, 1);
        assertEq(p.attestation, UID);
    }

    function test_zeroUidPaysFull() public {
        (bool ok, uint8 why) = g.isMember(alice, bytes32(0));
        assertFalse(ok);
        assertEq(why, 1);
        assertEq(g.quoteFor(alice, gated, "low", HOURS_20, bytes32(0)).payerPays, FULL);
        vm.prank(alice);
        uint256 pid = g.payMember(gated, "low", HOURS_20, bytes32(0), bytes32(0), FULL);
        GreenFeeDemo.Payment memory p = g.getPayment(pid);
        assertEq(p.subsidy, 0);
        assertEq(p.payerPays, FULL);
        assertEq(p.basis, 0);
        assertEq(p.attestation, bytes32(0));
        // plain pay on the gated scheme is also unsubsidised
        vm.prank(alice);
        uint256 p2 = g.pay(gated, "low", HOURS_20, bytes32(0));
        assertEq(g.getPayment(p2).subsidy, 0);
    }

    function _expectBad(address who, bytes32 uid, uint8 reason) internal {
        (bool ok, uint8 why) = g.isMember(who, uid);
        assertFalse(ok);
        assertEq(why, reason);
        assertEq(g.quoteFor(who, gated, "low", HOURS_20, uid).payerPays, FULL);
        vm.prank(who);
        vm.expectRevert(abi.encodeWithSelector(GreenFeeDemo.BadAttestation.selector, reason));
        g.payMember(gated, "low", HOURS_20, bytes32(0), uid, FULL);
    }

    function test_unknownUid() public {
        _expectBad(alice, keccak256("nothing"), 3);
    }

    function test_wrongSchema() public {
        _attest(UID, keccak256("other"), attester, alice, 0);
        _expectBad(alice, UID, 4);
    }

    function test_wrongAttester() public {
        _attest(UID, schema, address(0xBAD), alice, 0);
        _expectBad(alice, UID, 5);
    }

    function test_otherRecipient() public {
        // alice's attestation used by bob
        _expectBad(bob, UID, 6);
    }

    function test_revoked() public {
        eas.revoke(UID);
        _expectBad(alice, UID, 7);
    }

    function test_expired() public {
        vm.warp(1_000_000);
        _attest(UID, schema, attester, alice, uint64(block.timestamp + 100));
        (bool ok,) = g.isMember(alice, UID);
        assertTrue(ok);
        vm.warp(block.timestamp + 100); // expiry is exclusive: at the expiry time it is over
        _expectBad(alice, UID, 8);
    }

    function test_attesterZeroIsEmergencyStop() public {
        g.setAttester(address(0));
        _expectBad(alice, UID, 2);
        // zero uid still pays, unsubsidised
        vm.prank(alice);
        g.payMember(gated, "low", HOURS_20, bytes32(0), bytes32(0), FULL);
    }

    function test_unsetEasIsStopped() public {
        GreenFeeDemo h = new GreenFeeDemo();
        (bool ok, uint8 why) = h.isMember(alice, UID);
        assertFalse(ok);
        assertEq(why, 2);
    }

    function test_onlyOperatorConfigures() public {
        vm.startPrank(alice);
        vm.expectRevert(GreenFeeDemo.NotOperator.selector);
        g.setEas(address(eas), schema);
        vm.expectRevert(GreenFeeDemo.NotOperator.selector);
        g.setAttester(alice);
        vm.stopPrank();
    }

    function test_attestationPayRejectedOnOpenScheme() public {
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotAnEasScheme.selector);
        g.payMember(open, "low", HOURS_20, bytes32(0), UID, FULL);
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotAnEasScheme.selector);
        g.payMember(open, "low", HOURS_20, bytes32(0), bytes32(0), FULL);
    }

    function test_openSchemeStillGivesEveryoneTheSubsidy() public {
        assertEq(g.quote(open, "low", HOURS_20).payerPays, SUBSIDISED);
        vm.prank(bob);
        uint256 pid = g.pay(open, "low", HOURS_20, bytes32(0));
        assertEq(g.getPayment(pid).subsidy, 5_000_000);
        assertEq(g.getPayment(pid).basis, 0);
    }

    function test_gateIsFixedAtCreation() public {
        assertEq(g.gate(open), 0);
        assertEq(g.gate(gated), 1);
        // there is no setter: the only function that writes the gate is createScheme
        (bool ok,) = address(g).call(abi.encodeWithSignature("setGate(uint256,uint8)", open, 1));
        assertFalse(ok);
        GreenFeeDemo.Rules memory r = GreenFeeDemo.Rules(0, 0, 5_000, 20_000, 0, 0);
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.createScheme("x", r, 2);
    }

    function test_maxPayerPaysCap() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GreenFeeDemo.TooExpensive.selector, SUBSIDISED, SUBSIDISED - 1));
        g.payMember(gated, "low", HOURS_20, bytes32(0), UID, SUBSIDISED - 1);
        // the deposit ran out after the quote: the payer would pay more, so it reverts
        g.withdraw(gated, 100e6); // the owner (this test) takes the deposit back
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(GreenFeeDemo.TooExpensive.selector, FULL, SUBSIDISED));
        g.payMember(gated, "low", HOURS_20, bytes32(0), UID, SUBSIDISED);
        // payUpTo on an open scheme
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(GreenFeeDemo.TooExpensive.selector, SUBSIDISED, 1));
        g.payUpTo(open, "low", HOURS_20, bytes32(0), 1);
    }

    function test_highEmissionNeverGetsSubsidy() public {
        vm.prank(alice);
        uint256 pid = g.payMember(gated, "high", HOURS_20, bytes32(0), UID, type(uint256).max);
        assertEq(g.getPayment(pid).subsidy, 0);
        assertEq(g.getPayment(pid).basis, 0);
    }
}

/// Fork tests read the real EAS on Sepolia. They are skipped unless FORK=1:
///   FORK=1 forge test --fork-url https://ethereum-sepolia-rpc.publicnode.com --match-contract Fork
contract GreenFeeEasForkTest is Test {
    address constant SEPOLIA_EAS = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;
    // An attestation that exists on Sepolia (found through sepolia.easscan.org/graphql on 2026-10-09).
    bytes32 constant UID = 0x000108661b30d0071b5f56fcc21e63663e2eda330c6e35935884f559760d6fef;
    bytes32 constant SCHEMA = 0xba4171c92572b1e4f241d044c32cdf083be9fd946b8766977558ca6378c824e2;
    address constant ATTESTER = 0xf6E32B1055FA785874401E8c6D52F2452B70aD53;
    address constant RECIPIENT = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;

    function test_ForkGetAttestationShape() public {
        if (!vm.envOr("FORK", false)) vm.skip(true);
        Attestation memory a = IEAS(SEPOLIA_EAS).getAttestation(UID);
        assertEq(a.uid, UID);
        assertEq(a.schema, SCHEMA);
        assertEq(a.attester, ATTESTER);
        assertEq(a.recipient, RECIPIENT);
        assertEq(a.revocationTime, 0);
        assertEq(a.expirationTime, 0);
        assertGt(a.time, 0);
        emit log_named_uint("data length", a.data.length);
        // unknown uid: all zero, no revert
        Attestation memory none = IEAS(SEPOLIA_EAS).getAttestation(keccak256("nope"));
        assertEq(none.uid, bytes32(0));
    }

    function test_ForkIsMemberAgainstRealEas() public {
        if (!vm.envOr("FORK", false)) vm.skip(true);
        GreenFeeDemo g = new GreenFeeDemo();
        g.setEas(SEPOLIA_EAS, SCHEMA);
        g.setAttester(ATTESTER);
        (bool ok, uint8 why) = g.isMember(RECIPIENT, UID);
        assertTrue(ok);
        assertEq(why, 0);
        (ok, why) = g.isMember(address(0xBEEF), UID);
        assertFalse(ok);
        assertEq(why, 6);
        g.setAttester(address(0xBAD));
        (ok, why) = g.isMember(RECIPIENT, UID);
        assertEq(why, 5);
    }
}
