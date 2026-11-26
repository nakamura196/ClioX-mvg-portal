// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CarbonChoiceRecord} from "../src/CarbonChoiceRecord.sol";

contract CarbonChoiceRecordTest is Test {
    CarbonChoiceRecord c;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 h = sha256("record");

    function setUp() public {
        c = new CarbonChoiceRecord();
    }

    function _record() internal returns (uint256) {
        vm.prank(alice);
        return c.record(h, "eu-north-1", 14_000, 2_840_000, 3, 2);
    }

    function test_mintsToCallerAndStoresRecord() public {
        uint256 id = _record();
        assertEq(id, 1);
        assertEq(c.ownerOf(id), alice);
        assertEq(c.balanceOf(alice), 1);
        assertTrue(c.locked(id));
        CarbonChoiceRecord.Record memory r = c.getRecord(id);
        assertEq(r.recordHash, h);
        assertEq(r.locationKey, "eu-north-1");
        assertEq(r.chosenMgCO2e, 14_000);
        assertEq(r.highestMgCO2e, 2_840_000);
        assertEq(c.tokensOf(alice).length, 1);
    }

    function test_cannotTransferOrApprove() public {
        uint256 id = _record();
        vm.startPrank(alice);
        vm.expectRevert(CarbonChoiceRecord.Soulbound.selector);
        c.transferFrom(alice, bob, id);
        vm.expectRevert(CarbonChoiceRecord.Soulbound.selector);
        c.safeTransferFrom(alice, bob, id);
        vm.expectRevert(CarbonChoiceRecord.Soulbound.selector);
        c.approve(bob, id);
        vm.expectRevert(CarbonChoiceRecord.Soulbound.selector);
        c.setApprovalForAll(bob, true);
        vm.stopPrank();
        assertEq(c.ownerOf(id), alice);
    }

    function test_rejectsBadInput() public {
        vm.startPrank(alice);
        vm.expectRevert(CarbonChoiceRecord.BadInput.selector);
        c.record(bytes32(0), "eu-north-1", 1, 2, 1, 2);
        vm.expectRevert(CarbonChoiceRecord.BadInput.selector);
        c.record(h, "eu-north-1", 3, 2, 1, 2); // chosen above highest
        vm.expectRevert(CarbonChoiceRecord.BadInput.selector);
        c.record(h, "EU\"north", 1, 2, 1, 2); // would break JSON
        vm.expectRevert(CarbonChoiceRecord.BadInput.selector);
        c.record(h, "eu-north-1", 1, 2, 0, 2);
        vm.expectRevert(CarbonChoiceRecord.BadInput.selector);
        c.record(h, "eu-north-1", 1, 2, 1, 3); // "unknown" cannot be recorded
        vm.stopPrank();
    }

    function test_tokenURIContainsFields() public {
        uint256 id = _record();
        string memory uri = c.tokenURI(id);
        assertTrue(vm.contains(uri, "\"value\":\"eu-north-1\""));
        assertTrue(vm.contains(uri, "\"value\":14000"));
        assertTrue(vm.contains(uri, "portal-estimated"));
        assertTrue(vm.contains(uri, vm.replace(vm.toString(h), "0x", "")));
    }

    function test_interfaces() public view {
        assertTrue(c.supportsInterface(0xb45a3c0e));
        assertTrue(c.supportsInterface(0x80ac58cd));
        assertFalse(c.supportsInterface(0xffffffff));
    }

    function test_unmintedReverts() public {
        vm.expectRevert(CarbonChoiceRecord.NotMinted.selector);
        c.ownerOf(1);
    }
}
