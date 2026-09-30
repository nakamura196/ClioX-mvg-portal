// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CarbonChoiceRecord} from "../src/CarbonChoiceRecord.sol";

/// Records one choice with the trial wallet, to check the portal's list and
/// file check without a browser wallet. Arguments come from the environment.
contract RecordSample is Script {
    function run() external {
        CarbonChoiceRecord c = CarbonChoiceRecord(vm.envAddress("CONTRACT"));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        uint256 id = c.record(
            vm.envBytes32("HASH"),
            vm.envString("KEY"),
            uint64(vm.envUint("CHOSEN")),
            uint64(vm.envUint("HIGHEST")),
            uint32(vm.envUint("ALT")),
            uint8(vm.envUint("Q"))
        );
        vm.stopBroadcast();
        console.log("token", id);
    }
}
