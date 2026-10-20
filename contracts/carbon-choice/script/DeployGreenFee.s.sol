// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";

/// Deploys GreenFeeDemo, registers the price table, points it at EAS (address,
/// member schema, trusted attester) and opens scheme #1 (subsidy open to everyone) with
/// the defaults shown on /carbon-choice. Scheme #2 has the same rules but needs an EAS
/// member attestation for the subsidy. The member schema must already be
/// registered (see RegisterMemberSchema.s.sol); only its UID is needed here.
/// The attester defaults to the deployer; set ATTESTER to use another address. Then, as a worked example, it puts
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

    address constant SEPOLIA_EAS = 0xC2679fBD37d54388Ce493F1DB75320D236e1815e;

    function run() external {
        string memory json = vm.readFile("cache/green-fee-locations.json");
        Loc[] memory locs = abi.decode(vm.parseJson(json, ".locations"), (Loc[]));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        GreenFeeDemo g = new GreenFeeDemo();
        for (uint256 i = 0; i < locs.length; i++) {
            g.setLocation(locs[i].key, locs[i].provider, uint64(locs[i].microPerHour), uint64(locs[i].mgPerHour));
        }
        g.setEas(vm.envOr("EAS", SEPOLIA_EAS), keccak256(abi.encodePacked("bool member", address(0), true)));
        g.setAttester(vm.envOr("ATTESTER", vm.addr(vm.envUint("PRIVATE_KEY"))));
        GreenFeeDemo.Rules memory rules = GreenFeeDemo.Rules({
            surchargeBps: 2_000,
            discountBps: 2_000,
            lowUpToMgPerHour: 5_000,
            highFromMgPerHour: 20_000,
            subsidyBps: 5_000,
            subsidyCapMicro: 5e6
        });
        uint256 id = g.createScheme("Clio-X demo", rules, 0);
        g.createScheme("Clio-X members (EAS)", rules, 1);
        g.faucet();
        g.deposit(id, 200e6);
        g.pay(id, "ap-northeast-1", 20 * 3600, bytes32(0));
        vm.stopBroadcast();
        console.log("GreenFeeDemo", address(g));
        console.log("block", block.number);
    }
}
