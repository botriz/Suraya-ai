// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║                                                            ║
 * ║    🎯 Mission System - سیستم مأموریت‌های ثریا        ║
 * ║                                                            ║
 * ║  تعریف و تخصیص مأموریت‌ها برای استخراج LOLOE         ║
 * ║                                                            ║
 * ╚════════════════════════════════════════════════════════════╝
 */

interface ILOLOE {
    function mint(address to, uint256 amount, string memory reason) external;
}

contract MissionSystem {
    // ============================================
    // 📊 STATE VARIABLES
    // ============================================
    
    ILOLOE public loloeToken;
    address public admin;
    
    // Mission Types
    enum MissionStatus { AVAILABLE, ASSIGNED, COMPLETED, EXPIRED }
    enum MissionDifficulty { EASY, MEDIUM, HARD, LEGENDARY }
    
    struct Mission {
        uint256 id;
        string titleFA;
        string titleAZ;
        string description;
        MissionDifficulty difficulty;
        MissionStatus status;
        uint256 rewardAmount; // LOLOE
        address assignedTo;
        uint256 createdAt;
        uint256 deadline;
        uint256 completedAt;
        bool requiresApproval;
    }
    
    mapping(uint256 => Mission) public missions;
    uint256 public missionCount = 0;
    
    // User Statistics
    struct UserStats {
        uint256 completedMissions;
        uint256 totalEarned;
        uint256 totalLevel;
        uint256 lastMissionAt;
    }
    
    mapping(address => UserStats) public userStats;
    
    // ============================================
    // 🎺 EVENTS
    // ============================================
    
    event MissionCreated(uint256 indexed missionId, string titleFA, uint256 reward);
    event MissionAssigned(uint256 indexed missionId, address indexed player);
    event MissionCompleted(uint256 indexed missionId, address indexed player, uint256 reward);
    event MissionExpired(uint256 indexed missionId);
    
    // ============================================
    // 🛡️ MODIFIERS
    // ============================================
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    // ============================================
    // 👤 CONSTRUCTOR
    // ============================================
    
    constructor(address _loloeToken) {
        admin = msg.sender;
        loloeToken = ILOLOE(_loloeToken);
    }
    
    // ============================================
    // 🎯 MISSION CREATION
    // ============================================
    
    function createMission(
        string memory _titleFA,
        string memory _titleAZ,
        string memory _description,
        MissionDifficulty _difficulty,
        uint256 _rewardAmount,
        uint256 _deadlineInHours
    ) public onlyAdmin returns (uint256) {
        uint256 missionId = ++missionCount;
        
        missions[missionId] = Mission({
            id: missionId,
            titleFA: _titleFA,
            titleAZ: _titleAZ,
            description: _description,
            difficulty: _difficulty,
            status: MissionStatus.AVAILABLE,
            rewardAmount: _rewardAmount,
            assignedTo: address(0),
            createdAt: block.timestamp,
            deadline: block.timestamp + (_deadlineInHours * 1 hours),
            completedAt: 0,
            requiresApproval: true
        });
        
        emit MissionCreated(missionId, _titleFA, _rewardAmount);
        return missionId;
    }
    
    // ============================================
    // 👤 MISSION ASSIGNMENT
    // ============================================
    
    function acceptMission(uint256 missionId) public {
        Mission storage mission = missions[missionId];
        
        require(mission.status == MissionStatus.AVAILABLE, "Mission not available");
        require(block.timestamp <= mission.deadline, "Mission expired");
        
        mission.status = MissionStatus.ASSIGNED;
        mission.assignedTo = msg.sender;
        
        emit MissionAssigned(missionId, msg.sender);
    }
    
    // ============================================
    // ✅ MISSION COMPLETION
    // ============================================
    
    function completeMission(uint256 missionId) public {
        Mission storage mission = missions[missionId];
        
        require(mission.status == MissionStatus.ASSIGNED, "Mission not assigned");
        require(mission.assignedTo == msg.sender, "Not assigned to you");
        require(block.timestamp <= mission.deadline, "Mission deadline passed");
        
        mission.status = MissionStatus.COMPLETED;
        mission.completedAt = block.timestamp;
        
        // Mint LOLOE reward
        loloeToken.mint(
            msg.sender,
            mission.rewardAmount,
            string(abi.encodePacked("Mission ", mission.titleFA))
        );
        
        // Update user stats
        userStats[msg.sender].completedMissions += 1;
        userStats[msg.sender].totalEarned += mission.rewardAmount;
        userStats[msg.sender].lastMissionAt = block.timestamp;
        
        emit MissionCompleted(missionId, msg.sender, mission.rewardAmount);
    }
    
    // ============================================
    // 📈 VIEW FUNCTIONS
    // ============================================
    
    function getMission(uint256 missionId) public view returns (Mission memory) {
        return missions[missionId];
    }
    
    function getUserStats(address user) public view returns (UserStats memory) {
        return userStats[user];
    }
    
    function getAvailableMissions() public view returns (uint256[] memory) {
        uint256[] memory availableMissions = new uint256[](missionCount);
        uint256 count = 0;
        
        for (uint256 i = 1; i <= missionCount; i++) {
            if (missions[i].status == MissionStatus.AVAILABLE) {
                availableMissions[count] = i;
                count++;
            }
        }
        
        return availableMissions;
    }
}
