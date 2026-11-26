// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";

/// Type 1 (provider rebate) and type 2 (portal fee waiver), alone and with types 3 and 4.
contract GreenFeeTypes12Test is Test {
    GreenFeeDemo g;
    address provLow = address(0x1001);
    address provHigh = address(0x1002);
    address portal = address(0x9047);
    address alice = address(0xA11CE);
    uint32 constant HOURS_20 = 20 * 3600;
    uint256 constant LOW_BASE = 11_160_000; // 0.558 PLAY/h x 20 h
    uint256 constant HIGH_BASE = 23_344_000; // 1.1672 PLAY/h x 20 h

    function setUp() public {
        g = new GreenFeeDemo();
        g.setLocation("low", provLow, 558_000, 590);
        g.setLocation("high", provHigh, 1_167_200, 30_888);
        g.setRebate("low", 1_000);
        g.setRebate("high", 1_000);
        vm.prank(alice);
        g.faucet();
    }

    function rules(bool rebate, uint16 fee, uint16 waiver) internal pure returns (GreenFeeDemo.Rules memory) {
        return GreenFeeDemo.Rules({
            surchargeBps: 0,
            discountBps: 0,
            lowUpToMgPerHour: 5_000,
            highFromMgPerHour: 20_000,
            subsidyBps: 0,
            subsidyCapMicro: 0,
            providerRebate: rebate,
            portalFeeBps: fee,
            feeWaiverBps: waiver
        });
    }

    function scheme(GreenFeeDemo.Rules memory r) internal returns (uint256 id) {
        vm.prank(portal);
        id = g.createScheme("t", r, 0);
    }

    function test_type1_rebateOnlyOnLowAndOnlyWhenPassedOn() public {
        uint256 on = scheme(rules(true, 0, 0));
        uint256 off = scheme(rules(false, 0, 0));

        GreenFeeDemo.Quote memory q = g.quote(on, "low", HOURS_20);
        assertEq(q.rebate, 1_116_000);
        assertEq(q.payerPays, LOW_BASE - 1_116_000);
        assertEq(g.quote(off, "low", HOURS_20).rebate, 0);
        assertEq(g.quote(on, "high", HOURS_20).rebate, 0); // high-emission: no rebate

        vm.prank(alice);
        uint256 pid = g.pay(on, "low", HOURS_20, bytes32(0));
        assertEq(g.balanceOf(provLow), LOW_BASE - 1_116_000); // provider bore it
        assertEq(g.getPayment(pid).rebate, 1_116_000);
        assertEq(g.getScheme(on).rebatesGiven, 1_116_000);
    }

    function test_type1_onlyProviderOrOperatorSetsRebate() public {
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotOperator.selector);
        g.setRebate("low", 5_000);
        vm.prank(provLow);
        g.setRebate("low", 2_500);
        (,,,, uint16 bps) = g.locations("low");
        assertEq(bps, 2_500);
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.setRebate("low", 10_001);
    }

    function test_type2_feeOnEveryJobWaivedOnLow() public {
        uint256 id = scheme(rules(false, 1_000, 10_000));

        GreenFeeDemo.Quote memory hi = g.quote(id, "high", HOURS_20);
        assertEq(hi.portalFee, 2_334_400);
        assertEq(hi.feeWaived, 0);
        assertEq(hi.payerPays, HIGH_BASE + 2_334_400);
        GreenFeeDemo.Quote memory lo = g.quote(id, "low", HOURS_20);
        assertEq(lo.portalFee, 1_116_000);
        assertEq(lo.feeWaived, 1_116_000);
        assertEq(lo.payerPays, LOW_BASE);

        vm.startPrank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0));
        g.pay(id, "low", HOURS_20, bytes32(0));
        vm.stopPrank();
        assertEq(g.balanceOf(portal), 2_334_400); // the owner receives the fee
        assertEq(g.balanceOf(provHigh), HIGH_BASE); // providers get the list price
        assertEq(g.balanceOf(provLow), LOW_BASE);
        GreenFeeDemo.Scheme memory s = g.getScheme(id);
        assertEq(s.feesIn, 2_334_400);
        assertEq(s.feesWaived, 1_116_000);
    }

    function test_type2_partialWaiver() public {
        uint256 id = scheme(rules(false, 1_000, 5_000));
        GreenFeeDemo.Quote memory lo = g.quote(id, "low", HOURS_20);
        assertEq(lo.feeWaived, 558_000);
        assertEq(lo.payerPays, LOW_BASE + 558_000);
    }

    /// All four at once: every PLAY the payer and the funds put in goes to the
    /// provider, the portal, or stays in the scheme's pool and deposit.
    function test_allFourTogether_balancesAndOrder() public {
        GreenFeeDemo.Rules memory r = rules(true, 1_000, 10_000);
        r.surchargeBps = 2_000;
        r.discountBps = 2_000;
        r.subsidyBps = 5_000;
        r.subsidyCapMicro = 5e6;
        uint256 id = scheme(r);
        vm.prank(alice);
        g.deposit(id, 100e6);
        vm.prank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0)); // fills the pool with 4.6688

        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        // base 11.16 - rebate 1.116 + fee 1.116 - waived 1.116 = 10.044; discount 2.232 -> 7.812; subsidy 3.906
        assertEq(q.rebate, 1_116_000);
        assertEq(q.discount, 2_232_000);
        assertEq(q.subsidy, 3_906_000);
        assertEq(q.payerPays, 3_906_000);
        vm.prank(alice);
        g.pay(id, "low", HOURS_20, bytes32(0));

        GreenFeeDemo.Scheme memory s = g.getScheme(id);
        assertEq(g.balanceOf(address(g)), s.pool + s.deposit);
        assertEq(g.balanceOf(provLow), LOW_BASE - 1_116_000);
        assertEq(g.balanceOf(portal), 2_334_400);
    }

    function test_discountNeverExceedsWhatIsDue() public {
        GreenFeeDemo.Rules memory r = rules(true, 0, 0);
        r.surchargeBps = 10_000;
        r.discountBps = 10_000;
        uint256 id = scheme(r);
        g.setRebate("low", 6_000);
        vm.startPrank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0)); // pool 23.344
        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        assertEq(q.discountWanted, LOW_BASE);
        assertEq(q.discount, LOW_BASE - q.rebate); // capped at what is left
        assertEq(q.payerPays, 0);
        g.pay(id, "low", HOURS_20, bytes32(0));
        vm.stopPrank();
        assertEq(g.balanceOf(address(g)), g.getScheme(id).pool);
    }

    function test_rejectsBadFee() public {
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.createScheme("x", rules(false, 10_001, 0), 0);
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.createScheme("x", rules(false, 0, 10_001), 0);
    }
}
