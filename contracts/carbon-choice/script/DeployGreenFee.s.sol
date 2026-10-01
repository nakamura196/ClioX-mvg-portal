// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";

/// Deploys GreenFeeDemo, registers the price table, and opens scheme #1 with
/// the defaults shown on /carbon-choice. Then, as a worked example, it puts
/// 200 PLAY into the deposit and pays one high-emission job, so the feebate
/// pool is not empty for the first visitor. Both show up in the ledger as the
/// trial wallet. The key comes from the environment (see deploy-green-fee.zsh).
contract DeployGreenFee is Script {
    struct Loc {
        string key;
        uint256 mgPerHour;
        uint256 microPerHour;
        address provider;
    }

    function run() external {
        string memory json = vm.readFile("cache/green-fee-locations.json");
        Loc[] memory locs = abi.decode(vm.parseJson(json, ".locations"), (Loc[]));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        GreenFeeDemo g = new GreenFeeDemo();
        for (uint256 i = 0; i < locs.length; i++) {
            g.setLocation(locs[i].key, locs[i].provider, uint64(locs[i].microPerHour), uint64(locs[i].mgPerHour));
        }
        uint256 id = g.createScheme(
            "Clio-X demo",
            GreenFeeDemo.Rules({
                surchargeBps: 2_000,
                discountBps: 2_000,
                lowUpToMgPerHour: 5_000,
                highFromMgPerHour: 20_000,
                subsidyBps: 5_000,
                subsidyCapMicro: 5e6
            })
        );
        g.faucet();
        g.deposit(id, 200e6);
        g.pay(id, "ap-northeast-1", 20 * 3600, bytes32(0));
        vm.stopBroadcast();
        console.log("GreenFeeDemo", address(g));
        console.log("block", block.number);
    }
}
