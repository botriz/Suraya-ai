// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║                                                            ║
 * ║  📋 Entity Registry - ثبت موجودیت‌های هوشمند          ║
 * ║                                                            ║
 * ║  15 موجودیت (7 طبیعی + 4 اقتصادی + 4 اجتماعی)      ║
 * ║                                                            ║
 * ╚════════════════════════════════════════════════════════════╝
 */

contract EntityRegistry {
    // ============================================
    // 📊 STATE VARIABLES
    // ============================================
    
    address public admin;
    
    enum EntityType { NATURAL, ECONOMIC, SOCIAL }
    
    struct Entity {
        uint256 id;
        string nameFA;
        string nameAZ;
        EntityType entityType;
        address controlledBy;
        uint256 createdAt;
        bool isActive;
        bytes32 stateHash;
        uint256 lastUpdate;
    }
    
    mapping(uint256 => Entity) public entities;
    uint256 public entityCount = 0;
    
    // Natural Entities
    uint256[] public naturalEntities;
    // Economic Entities
    uint256[] public economicEntities;
    // Social Entities
    uint256[] public socialEntities;
    
    // ============================================
    // 🎺 EVENTS
    // ============================================
    
    event EntityRegistered(uint256 indexed id, string nameFA, uint256 entityType);
    event EntityStateUpdated(uint256 indexed id, bytes32 newStateHash);
    event EntityActivated(uint256 indexed id);
    event EntityDeactivated(uint256 indexed id);
    
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
    
    constructor() {
        admin = msg.sender;
    }
    
    // ============================================
    // 📝 ENTITY REGISTRATION
    // ============================================
    
    function registerEntity(
        string memory _nameFA,
        string memory _nameAZ,
        EntityType _entityType,
        address _controlledBy
    ) public onlyAdmin returns (uint256) {
        uint256 entityId = ++entityCount;
        
        entities[entityId] = Entity({
            id: entityId,
            nameFA: _nameFA,
            nameAZ: _nameAZ,
            entityType: _entityType,
            controlledBy: _controlledBy,
            createdAt: block.timestamp,
            isActive: true,
            stateHash: keccak256(abi.encodePacked(_nameFA, _nameAZ, block.timestamp)),
            lastUpdate: block.timestamp
        });
        
        // Add to appropriate array
        if (_entityType == EntityType.NATURAL) {
            naturalEntities.push(entityId);
        } else if (_entityType == EntityType.ECONOMIC) {
            economicEntities.push(entityId);
        } else if (_entityType == EntityType.SOCIAL) {
            socialEntities.push(entityId);
        }
        
        emit EntityRegistered(entityId, _nameFA, uint256(_entityType));
        return entityId;
    }
    
    // ============================================
    // 🔄 STATE MANAGEMENT
    // ============================================
    
    function updateEntityState(uint256 entityId, bytes32 newStateHash) public {
        Entity storage entity = entities[entityId];
        require(msg.sender == entity.controlledBy || msg.sender == admin, "Unauthorized");
        
        entity.stateHash = newStateHash;
        entity.lastUpdate = block.timestamp;
        
        emit EntityStateUpdated(entityId, newStateHash);
    }
    
    // ============================================
    // ⚙️ ACTIVATION FUNCTIONS
    // ============================================
    
    function activateEntity(uint256 entityId) public onlyAdmin {
        Entity storage entity = entities[entityId];
        entity.isActive = true;
        emit EntityActivated(entityId);
    }
    
    function deactivateEntity(uint256 entityId) public onlyAdmin {
        Entity storage entity = entities[entityId];
        entity.isActive = false;
        emit EntityDeactivated(entityId);
    }
    
    // ============================================
    // 📈 VIEW FUNCTIONS
    // ============================================
    
    function getEntity(uint256 entityId) public view returns (Entity memory) {
        return entities[entityId];
    }
    
    function getNaturalEntitiesCount() public view returns (uint256) {
        return naturalEntities.length;
    }
    
    function getEconomicEntitiesCount() public view returns (uint256) {
        return economicEntities.length;
    }
    
    function getSocialEntitiesCount() public view returns (uint256) {
        return socialEntities.length;
    }
    
    function getEntitiesByType(EntityType entityType) public view returns (uint256[] memory) {
        if (entityType == EntityType.NATURAL) {
            return naturalEntities;
        } else if (entityType == EntityType.ECONOMIC) {
            return economicEntities;
        } else {
            return socialEntities;
        }
    }
}
