// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KattySkins
 * @notice On-chain cosmetic skin unlocks for Katty Paws. Each skin is bought
 *         once with a tiny ETH fee; ownership is a bit in a per-user bitmask.
 *         Not a tradeable NFT — purely a cosmetic unlock recorded on-chain.
 *         The builder code is appended as a calldata suffix by the frontend.
 *
 *         Skin 0 ("Classic") is free and owned by everyone implicitly, so it
 *         is not mintable here. Mintable ids: 1..5.
 */
contract KattySkins {
    address public owner;
    uint256 public constant MAX_ID = 5;

    // bit i set => caller owns skin i
    mapping(address => uint256) public ownedMask;

    event Minted(address indexed user, uint256 indexed id);

    constructor() {
        owner = msg.sender;
    }

    function priceOf(uint256 id) public pure returns (uint256) {
        if (id == 1) return 0.00002 ether;
        if (id == 2) return 0.00003 ether;
        if (id == 3) return 0.00004 ether;
        if (id == 4) return 0.00006 ether;
        if (id == 5) return 0.0001 ether;
        revert("Bad skin id");
    }

    function mint(uint256 id) external payable {
        require(id >= 1 && id <= MAX_ID, "Bad skin id");
        require(msg.value >= priceOf(id), "Fee too low");
        uint256 bit = uint256(1) << id;
        require(ownedMask[msg.sender] & bit == 0, "Already owned");
        ownedMask[msg.sender] |= bit;
        emit Minted(msg.sender, id);
    }

    function owns(address user, uint256 id) external view returns (bool) {
        if (id == 0) return true; // Classic is free for everyone
        return (ownedMask[user] >> id) & 1 == 1;
    }

    function withdraw(address payable to) external {
        require(msg.sender == owner, "Not owner");
        (bool ok, ) = to.call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }
}
