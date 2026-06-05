// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title KattyDailyStreak
 * @notice Free daily check-in (user pays only gas). One check-in per UTC day;
 *         consecutive days build a streak, a missed day resets it. No prize,
 *         no token — pure engagement + on-chain activity. Builder code is
 *         appended as a calldata suffix by the frontend.
 */
contract KattyDailyStreak {
    mapping(address => uint256) public lastDay;        // last UTC day index checked in
    mapping(address => uint256) public streak;         // current consecutive-day streak
    mapping(address => uint256) public totalCheckIns;  // lifetime check-ins

    event CheckedIn(address indexed user, uint256 streak, uint256 day);

    function checkIn() external {
        uint256 today = block.timestamp / 1 days;
        uint256 last = lastDay[msg.sender];
        require(today > last, "Already checked in today");

        if (last != 0 && today == last + 1) {
            streak[msg.sender] += 1;
        } else {
            streak[msg.sender] = 1;
        }
        lastDay[msg.sender] = today;
        totalCheckIns[msg.sender] += 1;

        emit CheckedIn(msg.sender, streak[msg.sender], today);
    }

    function getStreak(address user)
        external
        view
        returns (uint256 currentStreak, uint256 lastCheckInDay, bool canCheckInToday)
    {
        uint256 today = block.timestamp / 1 days;
        return (streak[user], lastDay[user], today > lastDay[user]);
    }
}
