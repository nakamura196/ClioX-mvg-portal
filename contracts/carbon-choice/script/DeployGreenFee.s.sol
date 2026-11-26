// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {GreenFeeDemo} from "../src/GreenFeeDemo.sol";

/// Deploys GreenFeeDemo, registers the price table, points it at EAS (address,
/// member schema, trusted attester) and opens scheme #1 (subsidy open to everyone) with
/// the defaults shown on /carbon-choice. Scheme #2 has the same rules but needs an EAS
/// member attestation for the subsidy. Schemes #3 to #6 turn on one type each
/// (1 provider rebate, 2 portal fee waiver, 3 surcharge and discount, 4 sponsor
/// deposit) and #7 turns on all four, each with two worked payments. The member schema must already be
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
        // Type 1: every demo provider offers 10 % off its low-emission jobs. Nobody
        // holds the demo provider keys, so the operator sets this on their behalf.
        for (uint256 i = 0; i < locs.length; i++) {
            g.setRebate(locs[i].key, 1_000);
        }
        // Each call makes a new struct: assigning a memory struct only copies the reference.
        GreenFeeDemo.Rules memory t34 = _rules(2_000, 2_000, 5_000, 5e6, false, 0, 0);
        GreenFeeDemo.Rules memory t1 = _rules(0, 0, 0, 0, true, 0, 0);
        GreenFeeDemo.Rules memory t2 = _rules(0, 0, 0, 0, false, 1_000, 10_000);
        GreenFeeDemo.Rules memory t3 = _rules(2_000, 2_000, 0, 0, false, 0, 0);
        GreenFeeDemo.Rules memory t4 = _rules(0, 0, 5_000, 5e6, false, 0, 0);
        GreenFeeDemo.Rules memory all = _rules(2_000, 2_000, 5_000, 5e6, true, 1_000, 10_000);

        // #1 and #2 keep their meaning from the earlier deployments (the page and the docs link to them).
        uint256 id = g.createScheme("Clio-X demo", t34, 0);
        g.createScheme("Clio-X members (EAS)", t34, 1);
        uint256[5] memory ids = [
            g.createScheme("Option 1: provider rebate", t1, 0),
            g.createScheme("Option 2: portal fee waiver", t2, 0),
            g.createScheme("Option 3: surcharge and discount", t3, 0),
            g.createScheme("Option 4: sponsor deposit", t4, 0),
            g.createScheme("All four together", all, 0)
        ];
        g.faucet();
        g.deposit(id, 200e6);
        g.pay(id, "ap-northeast-1", 20 * 3600, bytes32(0));
        // Worked examples: one high-emission job (Tokyo) then one low-emission job
        // (Stockholm) on each option, so every ledger shows who bore the difference.
        g.deposit(ids[3], 100e6);
        g.deposit(ids[4], 100e6);
        for (uint256 i = 0; i < ids.length; i++) {
            g.pay(ids[i], "ap-northeast-1", 20 * 3600, bytes32(0));
            g.pay(ids[i], "eu-north-1", 20 * 3600, bytes32(0));
        }
        vm.stopBroadcast();
        console.log("GreenFeeDemo", address(g));
        console.log("block", block.number);
    }

    function _rules(
        uint16 surchargeBps,
        uint16 discountBps,
        uint16 subsidyBps,
        uint64 subsidyCapMicro,
        bool providerRebate,
        uint16 portalFeeBps,
        uint16 feeWaiverBps
    ) private pure returns (GreenFeeDemo.Rules memory) {
        return GreenFeeDemo.Rules({
            surchargeBps: surchargeBps,
            discountBps: discountBps,
            lowUpToMgPerHour: 5_000,
            highFromMgPerHour: 20_000,
            subsidyBps: subsidyBps,
            subsidyCapMicro: subsidyCapMicro,
            providerRebate: providerRebate,
            portalFeeBps: portalFeeBps,
            feeWaiverBps: feeWaiverBps
        });
    }
}
