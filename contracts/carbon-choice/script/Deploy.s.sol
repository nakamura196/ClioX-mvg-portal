// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CarbonChoiceRecord} from "../src/CarbonChoiceRecord.sol";

/// Reads the key from the environment (see deploy.zsh), so it never appears
/// on the command line.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        CarbonChoiceRecord c = new CarbonChoiceRecord();
        vm.stopBroadcast();
        console.log("CarbonChoiceRecord", address(c));
    }
}
