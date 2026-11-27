// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";
import {GreenReward} from "../src/GreenReward.sol";

contract GreenRewardTest is Test {
    GreenFeeDemo play;
    GreenReward rw;
    uint256 checkerKey = 0xC0FFEE;
    address checker;
    address tanaka = address(0x05f1);
    bytes32 job = keccak256("job-1");
    // real job on place B, 97.6 s, 1 vCPU (2026-11-27): ~6.36 mg at B, ~107.4 mg at mdx
    uint64 chosenUg = 6_360;
    uint64 highestUg = 107_400;

    function setUp() public {
        checker = vm.addr(checkerKey);
        play = new GreenFeeDemo();
        // 1 PLAY per mg, at most 500 PLAY per job
        rw = new GreenReward(checker, address(play), 1e6, 500e6);
        play.faucet();
        play.transfer(address(rw), 1_000e6); // sponsor deposit
    }

    function _sign(uint256 key, bytes32 jobH, address to, uint64 c, uint64 h, uint64 exp)
        internal
        view
        returns (bytes memory)
    {
        bytes32 d = rw.digest(jobH, to, "provisional-place-b", "mdx", c, h, exp);
        bytes32 eth = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", d));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, eth);
        return abi.encodePacked(r, s, v);
    }

    function test_paysOwnerTheDifference() public {
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        vm.prank(address(0xBEEF)); // anyone may submit
        uint256 amt = rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        assertEq(amt, 101_040_000); // 101.04 mg -> 101.04 PLAY
        assertEq(play.balanceOf(tanaka), amt);
        assertTrue(rw.claimed(job));
    }

    function test_oncePerJob() public {
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        vm.expectRevert(GreenReward.AlreadyClaimed.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
    }

    function test_rejectsOtherSignerOrChangedFigures() public {
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory bad = _sign(0xBAD, job, tanaka, chosenUg, highestUg, exp);
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, bad);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg * 10, exp, sig);
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, address(0xA77AC), "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
    }

    function test_expiredAndNothingToReward() public {
        uint256 t0 = 1_000_000;
        vm.warp(t0);
        uint64 exp = uint64(t0 + 10);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        vm.warp(t0 + 11);
        vm.expectRevert(GreenReward.Expired.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        exp = uint64(t0 + 100);
        sig = _sign(checkerKey, job, tanaka, highestUg, highestUg, exp);
        vm.expectRevert(GreenReward.NothingToReward.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", highestUg, highestUg, exp, sig);
    }

    function test_capAndRateChange() public {
        rw.configure(checker, address(play), 10e6, 50e6); // 10 PLAY/mg, cap 50
        assertEq(rw.rewardFor(chosenUg, highestUg), 50e6);
        vm.prank(tanaka);
        vm.expectRevert(GreenReward.NotOwner.selector);
        rw.configure(checker, address(play), 1, 1);
    }

    function test_poolEmpty() public {
        rw.withdraw(address(this), 1_000e6);
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        vm.expectRevert(GreenReward.PoolEmpty.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
    }

    function test_rejectsZeroCheckerTokenOwner() public {
        vm.expectRevert(GreenReward.ZeroAddress.selector);
        new GreenReward(address(0), address(play), 1e6, 500e6);
        vm.expectRevert(GreenReward.ZeroAddress.selector);
        new GreenReward(checker, address(0), 1e6, 500e6);
        vm.expectRevert(GreenReward.ZeroAddress.selector);
        rw.configure(address(0), address(play), 1e6, 500e6);
        vm.expectRevert(GreenReward.ZeroAddress.selector);
        rw.setOwner(address(0));
        rw.setOwner(tanaka);
        assertEq(rw.owner(), tanaka);
    }

    function test_rejectsBadV() public {
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        sig[64] = bytes1(uint8(29));
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        // garbage signature recovers to zero -> rejected
        bytes memory junk = new bytes(65);
        junk[64] = bytes1(uint8(27));
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, junk);
    }

    function test_zeroCheckerSignatureNeverAccepted() public {
        // even if storage somehow held checker == 0, a junk signature must not pass
        vm.store(address(rw), bytes32(uint256(1)), bytes32(0)); // slot 1 = checker
        assertEq(rw.checker(), address(0));
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory junk = new bytes(65);
        junk[64] = bytes1(uint8(27));
        vm.expectRevert(GreenReward.BadSignature.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, junk);
    }

    function test_receivedTotals() public {
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        bytes32 job2 = keccak256("job-2");
        sig = _sign(checkerKey, job2, tanaka, 0, 2_000, exp);
        rw.claim(job2, tanaka, "provisional-place-b", "mdx", 0, 2_000, exp, sig);
        assertEq(rw.received(tanaka), 101_040_000 + 2_000_000);
        assertEq(rw.receivedCount(tanaka), 2);
        assertEq(rw.claimCount(), 2);
    }

    function test_importClaimed() public {
        bytes32[] memory js = new bytes32[](1);
        address[] memory to = new address[](1);
        uint256[] memory am = new uint256[](1);
        js[0] = job;
        to[0] = tanaka;
        am[0] = 101_169_000;
        vm.prank(tanaka);
        vm.expectRevert(GreenReward.NotOwner.selector);
        rw.importClaimed(js, to, am);
        uint256 poolBefore = play.balanceOf(address(rw));
        vm.expectEmit(true, true, false, true, address(rw));
        emit GreenReward.Imported(job, tanaka, 101_169_000);
        rw.importClaimed(js, to, am);
        assertTrue(rw.claimed(job));
        assertEq(rw.received(tanaka), 101_169_000);
        assertEq(rw.receivedCount(tanaka), 1);
        assertEq(rw.claimCount(), 1);
        assertEq(play.balanceOf(address(rw)), poolBefore); // nothing moved
        assertEq(play.balanceOf(tanaka), 0);
        // the imported job cannot be claimed again
        uint64 exp = uint64(block.timestamp + 3600);
        bytes memory sig = _sign(checkerKey, job, tanaka, chosenUg, highestUg, exp);
        vm.expectRevert(GreenReward.AlreadyClaimed.selector);
        rw.claim(job, tanaka, "provisional-place-b", "mdx", chosenUg, highestUg, exp, sig);
        // importing twice is rejected; mismatched lengths are rejected
        vm.expectRevert(GreenReward.AlreadyClaimed.selector);
        rw.importClaimed(js, to, am);
        vm.expectRevert(GreenReward.LengthMismatch.selector);
        rw.importClaimed(js, to, new uint256[](0));
    }

    /// Fixed vector shared with the Worker signer's TypeScript test.
    function test_digestFixedVector() public {
        vm.chainId(11155111);
        address at = 0x428745BC1aa9B5465A211742f5Dde111340CD3A0;
        vm.etch(at, address(rw).code);
        bytes32 d = GreenReward(at).digest(
            0x181208fcb9f84df29d22c1f506ec7ebbca616daa275bd84496afe1b34ad4179e,
            0x05f174c45840f431d58dA24E7aCE6D107Da1C085,
            "provisional-place-b",
            "mdx",
            6360,
            107400,
            1800000000
        );
        assertEq(d, 0xd0cb6d5f8d6131d3c1d4b4a4a7971b2bf6ef7c52d38fbe4afa09b6c06e9a788c);
    }
}
