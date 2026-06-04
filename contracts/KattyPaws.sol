// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title KattyPaws
 * @notice Skill-based cat-runner competition on Base.
 *
 * TRUST MODEL (read this before you ship anything):
 *  - WINNER SELECTION is fully trustless. The contract maintains the top-3
 *    leaderboard itself on every submitScore() call and pays winners directly.
 *    No owner, no off-chain "finalize" step decides who wins.
 *  - SCORE AUTHENTICITY is NOT trustless. submitScore() requires a signature
 *    from `scoreSigner` (an off-chain validator that replays the run to confirm
 *    it's real). That signer cannot pick winners — it can only attest scores.
 *    BUT whoever controls the scoreSigner key could forge a high score for a
 *    wallet they own. That is the security floor for an action game without
 *    zk-proofs. Do not claim "fully trustless" in the UI. It isn't.
 */
contract KattyPaws is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ── Constants ──────────────────────────────────────────
    uint256 public constant CYCLE_DURATION = 10 days;
    uint256 public constant PLAY_FEE       = 0.000001 ether; // protocol fee, NOT gas
    uint256 public constant PRIZE_EACH     = 5 * 1e6;        // $5 USDC (6 decimals)
    uint8   public constant TOP_N          = 3;

    // ── State ──────────────────────────────────────────────
    IERC20  public immutable usdc;
    address public scoreSigner; // off-chain validator key (attests scores only)

    uint256 public cycleId;
    mapping(uint256 => uint256) public cycleStart;                       // cycleId => start ts
    mapping(uint256 => mapping(address => uint256)) public bestScore;    // cycleId => player => best
    mapping(uint256 => address[TOP_N]) public topWallets;               // cycleId => leaders (sorted desc)
    mapping(uint256 => uint256[TOP_N]) public topScores;                // cycleId => leader scores (sorted desc)
    mapping(uint256 => mapping(address => bool)) public claimed;        // cycleId => player => claimed

    // ── Events ─────────────────────────────────────────────
    event PlayFeePaid(address indexed player, uint256 indexed cycleId);
    event ScoreSubmitted(address indexed player, uint256 score, uint256 indexed cycleId);
    event LeaderboardChanged(uint256 indexed cycleId, address[TOP_N] wallets, uint256[TOP_N] scores);
    event CycleStarted(uint256 indexed cycleId, uint256 startTime);
    event PrizeClaimed(uint256 indexed cycleId, address indexed winner, uint256 amount);
    event ScoreSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // ── Constructor ────────────────────────────────────────
    constructor(address _usdc, address _scoreSigner) Ownable(msg.sender) {
        require(_usdc != address(0) && _scoreSigner != address(0), "zero address");
        usdc = IERC20(_usdc);
        scoreSigner = _scoreSigner;
        cycleId = 1;
        cycleStart[1] = block.timestamp;
        emit CycleStarted(1, block.timestamp);
    }

    // ── Cycle status ───────────────────────────────────────
    function cycleEnded(uint256 cid) public view returns (bool) {
        return block.timestamp >= cycleStart[cid] + CYCLE_DURATION;
    }

    function timeLeft() external view returns (uint256) {
        uint256 end = cycleStart[cycleId] + CYCLE_DURATION;
        if (block.timestamp >= end) return 0;
        return end - block.timestamp;
    }

    // ── Pay to play (one tx per game session) ──────────────
    function payToPlay() external payable {
        require(!cycleEnded(cycleId), "cycle ended");
        require(msg.value >= PLAY_FEE, "fee too low");
        emit PlayFeePaid(msg.sender, cycleId);
    }

    // ── Submit a validated score ───────────────────────────
    // The validator signs keccak256(player, score, cycleId, nonce).
    // Replay is harmless: a re-sent score fails the "new best" check.
    function submitScore(uint256 score, uint256 nonce, bytes calldata sig) external {
        uint256 cid = cycleId;
        require(!cycleEnded(cid), "cycle ended");

        bytes32 digest = keccak256(abi.encodePacked(msg.sender, score, cid, nonce))
            .toEthSignedMessageHash();
        require(digest.recover(sig) == scoreSigner, "bad signature");

        require(score > bestScore[cid][msg.sender], "not a new best");
        bestScore[cid][msg.sender] = score;
        emit ScoreSubmitted(msg.sender, score, cid);

        _updateTop(cid, msg.sender, score);
    }

    // ── On-chain top-3 maintenance (the trustless part) ────
    function _updateTop(uint256 cid, address player, uint256 score) internal {
        address[TOP_N] storage tw = topWallets[cid];
        uint256[TOP_N] storage ts = topScores[cid];

        // Already ranked? Update that single slot (prevents one wallet holding two slots).
        bool inTop = false;
        for (uint8 i = 0; i < TOP_N; i++) {
            if (tw[i] == player) { ts[i] = score; inTop = true; break; }
        }

        if (!inTop) {
            // Find the weakest current slot and replace it if beaten.
            uint8 minIdx = 0;
            for (uint8 i = 1; i < TOP_N; i++) {
                if (ts[i] < ts[minIdx]) minIdx = i;
            }
            if (score > ts[minIdx]) {
                tw[minIdx] = player;
                ts[minIdx] = score;
            } else {
                return; // didn't make the top N
            }
        }

        // Sort the 3 slots descending.
        for (uint8 i = 0; i < TOP_N; i++) {
            for (uint8 j = i + 1; j < TOP_N; j++) {
                if (ts[j] > ts[i]) {
                    (ts[i], ts[j]) = (ts[j], ts[i]);
                    (tw[i], tw[j]) = (tw[j], tw[i]);
                }
            }
        }
        emit LeaderboardChanged(cid, tw, ts);
    }

    // ── Winner claims own prize (no owner action) ──────────
    function claimPrize(uint256 cid) external nonReentrant {
        require(cycleEnded(cid), "cycle not ended");
        require(!claimed[cid][msg.sender], "already claimed");

        address[TOP_N] storage tw = topWallets[cid];
        bool isWinner = false;
        for (uint8 i = 0; i < TOP_N; i++) {
            if (tw[i] == msg.sender && tw[i] != address(0)) { isWinner = true; break; }
        }
        require(isWinner, "not a winner");

        claimed[cid][msg.sender] = true;
        usdc.safeTransfer(msg.sender, PRIZE_EACH);
        emit PrizeClaimed(cid, msg.sender, PRIZE_EACH);
    }

    // ── Permissionless cycle roll (anyone can call once ended) ──
    function startNewCycle() external {
        require(cycleEnded(cycleId), "current cycle still active");
        cycleId += 1;
        cycleStart[cycleId] = block.timestamp;
        emit CycleStarted(cycleId, block.timestamp);
    }

    // ── Funding (sponsorship, not winner selection) ────────
    function depositPrize(uint256 amount) external onlyOwner {
        usdc.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdrawFees() external onlyOwner {
        uint256 bal = address(this).balance;
        (bool ok, ) = payable(owner()).call{value: bal}("");
        require(ok, "withdraw failed");
    }

    // Rotate the validator key if it leaks. NOTE: this is a trust vector —
    // the owner can repoint the signer. Documented, not hidden.
    function setScoreSigner(address newSigner) external onlyOwner {
        require(newSigner != address(0), "zero address");
        emit ScoreSignerUpdated(scoreSigner, newSigner);
        scoreSigner = newSigner;
    }

    // ── Views ──────────────────────────────────────────────
    function getTop(uint256 cid)
        external
        view
        returns (address[TOP_N] memory wallets, uint256[TOP_N] memory scores)
    {
        return (topWallets[cid], topScores[cid]);
    }
}
