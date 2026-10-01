// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";

contract GreenFeeDemoTest is Test {
    GreenFeeDemo g;
    address provLow = address(0x1001);
    address provHigh = address(0x1002);
    address provMid = address(0x1003);
    address alice = address(0xA11CE);
    address sponsor = address(0x5905);
    uint32 constant HOURS_20 = 20 * 3600;

    function setUp() public {
        g = new GreenFeeDemo();
        // Stockholm-like, Tokyo-like, Oregon-like (per hour)
        g.setLocation("low", provLow, 558_000, 590);
        g.setLocation("high", provHigh, 1_167_200, 30_888);
        g.setLocation("mid", provMid, 804_800, 11_952);
        vm.prank(alice);
        g.faucet();
        vm.prank(sponsor);
        g.faucet();
    }

    function rules(uint16 sur, uint16 dis, uint16 sub, uint64 cap) internal pure returns (GreenFeeDemo.Rules memory) {
        return GreenFeeDemo.Rules({
            surchargeBps: sur,
            discountBps: dis,
            lowUpToMgPerHour: 5_000,
            highFromMgPerHour: 20_000,
            subsidyBps: sub,
            subsidyCapMicro: cap
        });
    }

    function test_faucetTopsUpOnly() public {
        assertEq(g.balanceOf(alice), 1_000e6);
        vm.prank(alice);
        g.faucet();
        assertEq(g.balanceOf(alice), 1_000e6);
    }

    function test_onlyOperatorSetsLocations() public {
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotOperator.selector);
        g.setLocation("x", provLow, 1, 1);
    }

    function test_feebateIsRevenueNeutral() public {
        uint256 id = g.createScheme("t3", rules(2_000, 2_000, 0, 0));

        // No surcharge paid yet: the pool is empty, so no discount.
        GreenFeeDemo.Quote memory q0 = g.quote(id, "low", HOURS_20);
        assertEq(q0.base, 11_160_000);
        assertEq(q0.discountWanted, 2_232_000);
        assertEq(q0.discount, 0);
        assertEq(q0.payerPays, 11_160_000);

        // A high-emission job pays a 20 % surcharge into the pool.
        vm.prank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0));
        assertEq(g.balanceOf(provHigh), 23_344_000);
        assertEq(g.getScheme(id).pool, 4_668_800);

        // Now the low-emission job gets its discount; provider still gets the list price.
        uint256 before = g.balanceOf(alice);
        vm.prank(alice);
        g.pay(id, "low", HOURS_20, bytes32(uint256(1)));
        assertEq(before - g.balanceOf(alice), 11_160_000 - 2_232_000);
        assertEq(g.balanceOf(provLow), 11_160_000);
        assertEq(g.getScheme(id).pool, 4_668_800 - 2_232_000);

        // Middle band: list price, nothing else.
        GreenFeeDemo.Quote memory qm = g.quote(id, "mid", HOURS_20);
        assertEq(qm.band, 1);
        assertEq(qm.payerPays, qm.base);

        // Contract holds exactly the pool.
        assertEq(g.balanceOf(address(g)), g.getScheme(id).pool);
    }

    function test_discountLimitedToPool() public {
        uint256 id = g.createScheme("t3", rules(100, 5_000, 0, 0)); // 1 % in, 50 % out
        vm.prank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0)); // pool = 233_440
        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        assertEq(q.discount, 233_440);
        assertLt(q.discount, q.discountWanted);
    }

    function test_subsidyShareCapAndDeposit() public {
        uint256 id = g.createScheme("t4", rules(0, 0, 5_000, 5_000_000)); // 50 %, cap 5 PLAY

        // No deposit yet: no subsidy.
        assertEq(g.quote(id, "low", HOURS_20).subsidy, 0);

        vm.prank(sponsor);
        g.deposit(id, 100e6);
        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        assertEq(q.subsidy, 5_000_000); // half would be 5.58, capped at 5
        assertEq(q.payerPays, 6_160_000);

        // Not for middle or high bands.
        assertEq(g.quote(id, "mid", HOURS_20).subsidy, 0);
        assertEq(g.quote(id, "high", HOURS_20).subsidy, 0);

        vm.prank(alice);
        uint256 pid = g.pay(id, "low", HOURS_20, keccak256("record"));
        GreenFeeDemo.Payment memory p = g.getPayment(pid);
        assertEq(p.subsidy, 5_000_000);
        assertEq(p.payer, alice);
        assertEq(p.ref, keccak256("record"));
        assertEq(p.locationKey, "low");
        assertEq(g.balanceOf(provLow), 11_160_000);
        GreenFeeDemo.Scheme memory s = g.getScheme(id);
        assertEq(s.deposit, 95e6);
        assertEq(s.subsidiesOut, 5e6);
        assertEq(g.paymentsOf(id).length, 1);
    }

    function test_bothTypesTogether() public {
        uint256 id = g.createScheme("t3+t4", rules(2_000, 2_000, 5_000, 10e6));
        vm.prank(sponsor);
        g.deposit(id, 50e6);
        vm.prank(alice);
        g.pay(id, "high", HOURS_20, bytes32(0));
        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        // 11.16 - 2.232 = 8.928, half = 4.464
        assertEq(q.discount, 2_232_000);
        assertEq(q.subsidy, 4_464_000);
        assertEq(q.payerPays, 4_464_000);
    }

    function test_depositRunsOut() public {
        uint256 id = g.createScheme("t4", rules(0, 0, 10_000, 100e6));
        vm.prank(sponsor);
        g.deposit(id, 3e6);
        GreenFeeDemo.Quote memory q = g.quote(id, "low", HOURS_20);
        assertEq(q.subsidy, 3e6);
    }

    function test_onlyOwnerChangesRulesAndWithdraws() public {
        vm.prank(sponsor);
        uint256 id = g.createScheme("mine", rules(0, 0, 5_000, 1e6));
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotSchemeOwner.selector);
        g.setRules(id, rules(0, 0, 10_000, 1e6));

        vm.prank(alice);
        g.deposit(id, 10e6); // anyone may fund
        vm.prank(alice);
        vm.expectRevert(GreenFeeDemo.NotSchemeOwner.selector);
        g.withdraw(id, 1e6);

        vm.prank(sponsor);
        g.withdraw(id, 10e6);
        assertEq(g.getScheme(id).deposit, 0);
        assertEq(g.balanceOf(sponsor), 1_010e6);
    }

    function test_rejectsBadRules() public {
        GreenFeeDemo.Rules memory r = rules(0, 0, 0, 0);
        r.lowUpToMgPerHour = 20_000;
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.createScheme("bad", r);
        vm.expectRevert(GreenFeeDemo.BadInput.selector);
        g.createScheme("bad", rules(10_001, 0, 0, 0));
    }

    function test_cannotPayWithoutBalance() public {
        uint256 id = g.createScheme("t3", rules(0, 0, 0, 0));
        vm.prank(address(0xBEEF));
        vm.expectRevert(GreenFeeDemo.InsufficientBalance.selector);
        g.pay(id, "low", HOURS_20, bytes32(0));
    }

    function test_unknownLocationAndScheme() public {
        vm.expectRevert(GreenFeeDemo.NoSuchScheme.selector);
        g.quote(1, "low", 60);
        uint256 id = g.createScheme("t3", rules(0, 0, 0, 0));
        vm.expectRevert(GreenFeeDemo.NoSuchLocation.selector);
        g.quote(id, "nowhere", 60);
    }
}
