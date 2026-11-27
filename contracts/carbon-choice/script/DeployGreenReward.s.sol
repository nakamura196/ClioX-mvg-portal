// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GreenReward} from "../src/GreenReward.sol";

interface IPlay {
    function faucet() external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address who) external view returns (uint256);
}

/// Deploys GreenReward with the operator (trial wallet) as owner, pays in PLAY
/// (GreenFeeDemo on Sepolia), 1 PLAY per mg of the estimated difference, at most
/// 500 PLAY per job; then tops the operator up from the PLAY faucet and deposits
/// its whole PLAY balance as the sponsor pool. Key and checker address come from
/// the environment (see deploy-green-reward.zsh).
contract DeployGreenReward is Script {
    address constant PLAY = 0xa497eDb2e5B86a223737C66002cb24896AC9c932;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address checker = vm.envAddress("CHECKER");
        vm.startBroadcast(key);
        GreenReward rw = new GreenReward(checker, PLAY, 1e6, 500e6);
        IPlay(PLAY).faucet();
        uint256 bal = IPlay(PLAY).balanceOf(vm.addr(key));
        IPlay(PLAY).transfer(address(rw), bal);
        vm.stopBroadcast();
        console.log("GreenReward", address(rw));
        console.log("checker", checker);
        console.log("pool (PLAY units)", bal);
    }
}

interface IOldGreenReward {
    function owner() external view returns (address);
    function claimed(bytes32) external view returns (bool);
    function withdraw(address to, uint256 amount) external;
}

/// 2026-11-27: replaces the first GreenReward (0x4287…D3A0) with the hardened one.
/// Deploys the new contract with the same parameters, carries over the one claim the
/// old contract paid (so that job cannot be claimed again), withdraws the old pool to
/// the operator and deposits exactly that amount into the new contract. No faucet.
contract MigrateGreenReward is Script {
    address constant PLAY = 0xa497eDb2e5B86a223737C66002cb24896AC9c932;
    address constant OLD = 0x428745BC1aa9B5465A211742f5Dde111340CD3A0;
    bytes32 constant JOB = 0x181208fcb9f84df29d22c1f506ec7ebbca616daa275bd84496afe1b34ad4179e;
    address constant TO = 0x05f174c45840f431d58dA24E7aCE6D107Da1C085;
    uint256 constant PAID = 101_169_000;

    function run() external {
        uint256 key = vm.envUint("PRIVATE_KEY");
        address checker = vm.envAddress("CHECKER");
        address op = vm.addr(key);
        require(IOldGreenReward(OLD).owner() == op, "not old owner");
        require(IOldGreenReward(OLD).claimed(JOB), "old job not claimed");
        uint256 oldPool = IPlay(PLAY).balanceOf(OLD);
        uint256 opBefore = IPlay(PLAY).balanceOf(op);
        console.log("old pool (PLAY units)", oldPool);
        console.log("operator PLAY before", opBefore);

        bytes32[] memory js = new bytes32[](1);
        address[] memory to = new address[](1);
        uint256[] memory am = new uint256[](1);
        js[0] = JOB;
        to[0] = TO;
        am[0] = PAID;

        vm.startBroadcast(key);
        GreenReward rw = new GreenReward(checker, PLAY, 1e6, 500e6);
        rw.importClaimed(js, to, am);
        IOldGreenReward(OLD).withdraw(op, oldPool);
        IPlay(PLAY).transfer(address(rw), oldPool);
        vm.stopBroadcast();

        console.log("GreenReward", address(rw));
        console.log("checker", checker);
        console.log("new pool (PLAY units)", IPlay(PLAY).balanceOf(address(rw)));
        console.log("old pool after", IPlay(PLAY).balanceOf(OLD));
        console.log("operator PLAY after", IPlay(PLAY).balanceOf(op));
    }
}
