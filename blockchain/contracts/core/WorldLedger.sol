// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║                                                            ║
 * ║        🌍 World Ledger - دفتر جهان ثریا                ║
 * ║                                                            ║
 * ║  ثبت تمام تراکنش‌ها و رویدادهای جهان دیجیتال         ║
 * ║                                                            ║
 * ╚════════════════════════════════════════════════════════════╝
 */

interface ILOLOE {
    function mint(address to, uint256 amount, string memory reason) external;
    function burn(uint256 amount, string memory reason) external;
}

contract WorldLedger {
    // ============================================
    // 📊 STATE VARIABLES
    // ============================================
    
    ILOLOE public loloeToken;
    address public admin;
    
    // Entity Registry
    struct Entity {
        uint256 id;
        string nameFA;
        string nameAZ;
        string entityType; // natural, economic, social
        uint256 createdAt;
        address owner;
        bool isActive;
    }
    
    mapping(uint256 => Entity) public entities;
    uint256 public entityCount = 0;
    
    // Transaction Log
    struct Transaction {
        uint256 id;
        address from;
        address to;
        uint256 amount;
        string reason;
        uint256 timestamp;
        bytes32 worldStateHash;
    }
    
    mapping(uint256 => Transaction) public transactions;
    uint256 public transactionCount = 0;
    
    // State History
    struct StateSnapshot {
        uint256 timestamp;
        bytes32 hash;
        string description;
    }
    
    mapping(uint256 => StateSnapshot) public stateHistory;
    uint256 public snapshotCount = 0;
    
    // ============================================
    // 🎺 EVENTS
    // ============================================
    
    event EntityRegistered(uint256 indexed id, string nameFA, string entityType);
    event TransactionRecorded(uint256 indexed txId, address from, address to, uint256 amount);
    event StateSnapshotRecorded(uint256 indexed snapshotId, bytes32 hash);
    
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
    // 📝 ENTITY FUNCTIONS
    // ============================================
    
    function registerEntity(
        string memory _nameFA,
        string memory _nameAZ,
        string memory _entityType
    ) public returns (uint256) {
        require(bytes(_nameFA).length > 0, "Name required");
        
        uint256 entityId = ++entityCount;
        
        entities[entityId] = Entity({
            id: entityId,
            nameFA: _nameFA,
            nameAZ: _nameAZ,
            entityType: _entityType,
            createdAt: block.timestamp,
            owner: msg.sender,
            isActive: true
        });
        
        emit EntityRegistered(entityId, _nameFA, _entityType);
        return entityId;
    }
    
    function getEntity(uint256 entityId) public view returns (Entity memory) {
        return entities[entityId];
    }
    
    // ============================================
    // 📊 TRANSACTION FUNCTIONS
    // ============================================
    
    function recordTransaction(
        address from,
        address to,
        uint256 amount,
        string memory reason
    ) public onlyAdmin returns (uint256) {
        uint256 txId = ++transactionCount;
        
        transactions[txId] = Transaction({
            id: txId,
            from: from,
            to: to,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp,
            worldStateHash: keccak256(abi.encodePacked(block.timestamp, from, to, amount))
        });
        
        emit TransactionRecorded(txId, from, to, amount);
        return txId;
    }
    
    function getTransaction(uint256 txId) public view returns (Transaction memory) {
        return transactions[txId];
    }
    
    // ============================================
    // 📸 STATE SNAPSHOT FUNCTIONS
    // ============================================
    
    function recordStateSnapshot(string memory description) public onlyAdmin returns (uint256) {
        uint256 snapshotId = ++snapshotCount;
        
        bytes32 hash = keccak256(abi.encodePacked(
            block.timestamp,
            entityCount,
            transactionCount,
            description
        ));
        
        stateHistory[snapshotId] = StateSnapshot({
            timestamp: block.timestamp,
            hash: hash,
            description: description
        });
        
        emit StateSnapshotRecorded(snapshotId, hash);
        return snapshotId;
    }
    
    function getStateSnapshot(uint256 snapshotId) public view returns (StateSnapshot memory) {
        return stateHistory[snapshotId];
    }
    
    // ============================================
    // 📈 STATISTICS
    // ============================================
    
    function getWorldStats() public view returns (
        uint256 _entityCount,
        uint256 _transactionCount,
        uint256 _snapshotCount
    ) {
        return (entityCount, transactionCount, snapshotCount);
    }
}
