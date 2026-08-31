// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * ═══════════════════════════════════════════════════════════════
 * SURAYA COMPLETE CONTRACTS  –  همه قراردادها در یک فایل
 * ═══════════════════════════════════════════════════════════════
 * ۱. ARZAToken          – توکن اصلی
 * ۲. WorldRegistry      – ثبت جهان
 * ۳. EntityManager      – مدیریت موجودیت
 * ۴. MissionRewards     – پاداش مأموریت
 * ۵. DAOGovernance      – حکمرانی
 * ۶. Treasury           – خزانه
 * ۷. NFTIntelligence    – NFT هوشمند
 * ═══════════════════════════════════════════════════════════════
 */

/* ════════════════════════════════════════════
   ۱. ARZA TOKEN
════════════════════════════════════════════ */
contract ARZAToken {
    string public constant name = "توکن ثریا";
    string public constant nameEN = "ARZA Token";
    string public constant symbol = "ARZA";
    string public constant symbolFA = "ارزِ";
    uint8  public constant decimals = 8;

    uint256 public totalSupply;
    uint256 public maxSupply = 1_000_000_000 * 10**8;
    uint256 public circulatingSupply;
    uint256 public taxRate = 2;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public isMiner;
    mapping(address => bool) public isGovernor;

    address public admin;
    address public daoTreasury;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event MissionReward(address indexed player, uint256 amount, string mission);
    event BioGeneration(address indexed entity, uint256 amount);
    event TaxCollected(uint256 amount);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }

    constructor() {
        admin = msg.sender;
        daoTreasury = msg.sender;
    }

    function rewardMission(address player, uint256 amount, string memory missionType, uint256 difficulty) public {
        require(isMiner[msg.sender] || msg.sender == admin, "Not miner");
        uint256 finalAmount = amount * (100 + difficulty) / 100;
        require(totalSupply + finalAmount <= maxSupply, "Max supply");
        _mint(player, finalAmount);
        emit MissionReward(player, finalAmount, missionType);
    }

    function generateBio(address entity, uint256 baseAmount) public {
        require(msg.sender == entity || msg.sender == admin, "Not authorized");
        uint256 health = getEntityHealth(entity);
        uint256 total = baseAmount + (baseAmount * health / 100);
        require(totalSupply + total <= maxSupply, "Max supply");
        _mint(entity, total);
        emit BioGeneration(entity, total);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(balanceOf[msg.sender] >= value, "Insufficient");
        require(to != address(0), "Zero address");
        uint256 tax = value * taxRate / 100;
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value - tax;
        balanceOf[daoTreasury] += tax;
        emit Transfer(msg.sender, to, value - tax);
        emit TaxCollected(tax);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(balanceOf[from] >= value && allowance[from][msg.sender] >= value, "Allowance/Balance");
        uint256 tax = value * taxRate / 100;
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value - tax;
        balanceOf[daoTreasury] += tax;
        emit Transfer(from, to, value - tax);
        emit TaxCollected(tax);
        return true;
    }

    function applyDecay(address entity) public {
        uint256 daysInactive = (block.timestamp - getLastActivityTime(entity)) / 86400;
        if (daysInactive > 7) {
            uint256 penalty = balanceOf[entity] * daysInactive / 365;
            if (penalty > 0 && penalty <= balanceOf[entity]) {
                balanceOf[entity] -= penalty;
                totalSupply -= penalty;
                circulatingSupply -= penalty;
                emit Transfer(entity, address(0), penalty);
            }
        }
    }

    function seasonalBonus(address[] memory players, uint256 baseBonus) public onlyAdmin {
        for (uint i = 0; i < players.length; i++) {
            uint256 bonus = baseBonus * (10 + getLevel(players[i])) / 10;
            if (totalSupply + bonus <= maxSupply) _mint(players[i], bonus);
        }
    }

    function burn(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount, "Insufficient");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        circulatingSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }

    function setMiner(address a, bool s) public onlyAdmin { isMiner[a] = s; }
    function setGovernor(address a, bool s) public onlyAdmin { isGovernor[a] = s; }
    function setTaxRate(uint256 r) public onlyAdmin { require(r <= 10); taxRate = r; }
    function setDaoTreasury(address t) public onlyAdmin { require(t != address(0)); daoTreasury = t; }

    function _mint(address to, uint256 amount) internal {
        balanceOf[to] += amount;
        totalSupply += amount;
        circulatingSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function getEntityHealth(address) public pure returns (uint256) { return 75; }
    function getLastActivityTime(address) public view returns (uint256) { return block.timestamp; }
    function getLevel(address) public pure returns (uint256) { return 1; }
}

/* ════════════════════════════════════════════
   ۲. WORLD REGISTRY
   – مرکزیت اصلی جهان (مالک: ادمین)
   – زمین مرکزی هر شهر (شبکه مدیریتی یکپارچه)
   – سند زمین برای بازیکنان بر اساس فعالیت
   – ابلاغ قوانین از مراکز به کل جهان
   – اختیار کامل مالک برای هر تغییر
════════════════════════════════════════════ */
contract WorldRegistry {
    address public admin;

    struct GlobalCenter {
        string name;
        address owner;
        bytes32 landId;
        bool active;
        uint256 establishedAt;
    }
    GlobalCenter public globalCenter;

    struct City {
        string name;
        string country;
        int256 lat;
        int256 lng;
        uint256 population;
        uint256 prosperity;
        bool active;
        uint256 registeredAt;
        bytes32 centralLandId;
    }

    struct Land {
        bytes32 id;
        bytes32 cityId;
        address owner;
        string title;
        bool isCentral;
        bool isDeeded;
        uint256 valueScore;
        uint256 deededAt;
        bool active;
    }

    struct Decree {
        uint256 id;
        string title;
        string content;
        bytes32 originCenter;
        uint256 issuedAt;
        bool active;
    }

    mapping(bytes32 => City) public cities;
    mapping(bytes32 => Land) public lands;
    mapping(address => bytes32[]) public ownerLands;
    mapping(address => Entity) public entities;
    mapping(uint256 => Decree) public decrees;

    bytes32[] public cityIds;
    bytes32[] public landIds;
    address[] public entityAddresses;
    uint256 public decreeCount;

    struct Entity {
        string entityType;
        string name;
        address owner;
        uint256 health;
        uint256 level;
        uint256 lastActive;
        bool active;
    }

    event GlobalCenterEstablished(bytes32 landId, address owner);
    event CityRegistered(bytes32 indexed id, string name, bytes32 centralLandId);
    event LandDeeded(bytes32 indexed landId, address indexed owner, bytes32 cityId);
    event DecreeIssued(uint256 indexed id, string title, bytes32 originCenter);
    event DecreeRevoked(uint256 indexed id);
    event EntityRegistered(address indexed entity, string entityType, string name);
    event EntityUpdated(address indexed entity, uint256 health, uint256 level);
    event AdminRuleChanged(string rule, string details);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only owner/admin");
        _;
    }

    constructor() {
        admin = msg.sender;
        bytes32 gLand = keccak256(abi.encodePacked("GLOBAL_CENTER", block.timestamp));
        lands[gLand] = Land({
            id: gLand,
            cityId: bytes32(0),
            owner: admin,
            title: "مرکزیت اصلی جهان ثریا",
            isCentral: true,
            isDeeded: true,
            valueScore: 10000,
            deededAt: block.timestamp,
            active: true
        });
        landIds.push(gLand);
        ownerLands[admin].push(gLand);

        globalCenter = GlobalCenter({
            name: "مرکزیت اصلی ثریا",
            owner: admin,
            landId: gLand,
            active: true,
            establishedAt: block.timestamp
        });
        emit GlobalCenterEstablished(gLand, admin);
    }

    function registerCity(
        string memory name,
        string memory country,
        int256 lat,
        int256 lng,
        uint256 pop
    ) public onlyAdmin returns (bytes32) {
        bytes32 cityId = keccak256(abi.encodePacked(name, country, block.timestamp));
        bytes32 centralLand = keccak256(abi.encodePacked("CENTER", cityId, block.timestamp));

        lands[centralLand] = Land({
            id: centralLand,
            cityId: cityId,
            owner: admin,
            title: string(abi.encodePacked("مرکز مدیریتی شهر ", name)),
            isCentral: true,
            isDeeded: true,
            valueScore: 5000,
            deededAt: block.timestamp,
            active: true
        });
        landIds.push(centralLand);
        ownerLands[admin].push(centralLand);

        cities[cityId] = City({
            name: name,
            country: country,
            lat: lat,
            lng: lng,
            population: pop,
            prosperity: 50,
            active: true,
            registeredAt: block.timestamp,
            centralLandId: centralLand
        });
        cityIds.push(cityId);

        emit CityRegistered(cityId, name, centralLand);
        return cityId;
    }

    function deedLandToPlayer(
        bytes32 cityId,
        address player,
        string memory title,
        uint256 valueScore
    ) public onlyAdmin returns (bytes32) {
        require(player != address(0), "Invalid player");
        require(cities[cityId].active || cityId == bytes32(0), "City inactive");

        bytes32 landId = keccak256(abi.encodePacked(player, cityId, title, block.timestamp));
        lands[landId] = Land({
            id: landId,
            cityId: cityId,
            owner: player,
            title: title,
            isCentral: false,
            isDeeded: true,
            valueScore: valueScore,
            deededAt: block.timestamp,
            active: true
        });
        landIds.push(landId);
        ownerLands[player].push(landId);

        emit LandDeeded(landId, player, cityId);
        return landId;
    }

    function issueDecree(
        string memory title,
        string memory content,
        bytes32 originCenter
    ) public onlyAdmin returns (uint256) {
        require(lands[originCenter].isCentral, "Not a management center");
        decreeCount++;
        decrees[decreeCount] = Decree({
            id: decreeCount,
            title: title,
            content: content,
            originCenter: originCenter,
            issuedAt: block.timestamp,
            active: true
        });
        emit DecreeIssued(decreeCount, title, originCenter);
        return decreeCount;
    }

    function revokeDecree(uint256 id) public onlyAdmin {
        require(decrees[id].active, "Already inactive");
        decrees[id].active = false;
        emit DecreeRevoked(id);
    }

    function adminChangeRule(string memory ruleName, string memory details) public onlyAdmin {
        emit AdminRuleChanged(ruleName, details);
    }

    function transferAdmin(address newAdmin) public onlyAdmin {
        require(newAdmin != address(0));
        admin = newAdmin;
        globalCenter.owner = newAdmin;
        lands[globalCenter.landId].owner = newAdmin;
    }

    function registerEntity(address addr, string memory entityType, string memory name) public returns (bool) {
        require(entities[addr].owner == address(0), "Exists");
        entities[addr] = Entity(entityType, name, msg.sender, 100, 1, block.timestamp, true);
        entityAddresses.push(addr);
        emit EntityRegistered(addr, entityType, name);
        return true;
    }

    function updateEntityHealth(address addr, uint256 health) public {
        require(entities[addr].owner == msg.sender || msg.sender == admin, "Auth");
        require(health <= 100);
        entities[addr].health = health;
        entities[addr].lastActive = block.timestamp;
        emit EntityUpdated(addr, health, entities[addr].level);
    }

    function levelUp(address addr) public {
        require(entities[addr].owner == msg.sender || msg.sender == admin, "Auth");
        entities[addr].level += 1;
        entities[addr].lastActive = block.timestamp;
        emit EntityUpdated(addr, entities[addr].health, entities[addr].level);
    }

    function getCityCount() public view returns (uint256) { return cityIds.length; }
    function getLandCount() public view returns (uint256) { return landIds.length; }
    function getEntityCount() public view returns (uint256) { return entityAddresses.length; }
    function getOwnerLandCount(address owner) public view returns (uint256) { return ownerLands[owner].length; }
    function getOwnerLandAt(address owner, uint256 index) public view returns (bytes32) {
        require(index < ownerLands[owner].length, "OOB");
        return ownerLands[owner][index];
    }
    function getCityCentralLand(bytes32 cityId) public view returns (bytes32) {
        return cities[cityId].centralLandId;
    }
}

/* ════════════════════════════════════════════
   ۳. ENTITY MANAGER
════════════════════════════════════════════ */
contract EntityManager {
    address public admin;
    enum EntityType { Natural, Economic, Governance, Player, Hybrid }

    struct EntityData {
        bytes32 id; string name; EntityType entityType; string element;
        address owner; uint256 health; uint256 level; uint256 experience;
        uint256 lastActive; bool active; uint256 createdAt;
    }

    mapping(bytes32 => EntityData) public entities;
    mapping(bytes32 => mapping(string => uint256)) public stats;
    mapping(address => bytes32[]) public ownerEntities;
    mapping(bytes32 => bool) public exists;
    bytes32[] public allIds;
    uint256 public totalEntities;
    uint256 public constant XP_PER_LEVEL = 100;

    event EntityCreated(bytes32 indexed id, string name, EntityType t, address owner);
    event EntityLeveledUp(bytes32 indexed id, uint256 level);
    event EntityHealthUpdated(bytes32 indexed id, uint256 health);
    event EntityTransferred(bytes32 indexed id, address from, address to);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier onlyOwner(bytes32 id) { require(entities[id].owner == msg.sender || msg.sender == admin, "Not owner"); _; }
    modifier mustExist(bytes32 id) { require(exists[id], "Not exist"); _; }

    constructor() { admin = msg.sender; }

    function createEntity(string memory name, EntityType t, string memory element, address owner) public returns (bytes32) {
        require(bytes(name).length > 0 && owner != address(0));
        bytes32 id = keccak256(abi.encodePacked(name, owner, block.timestamp, totalEntities));
        entities[id] = EntityData(id, name, t, element, owner, 100, 1, 0, block.timestamp, true, block.timestamp);
        stats[id]["strength"] = 10;
        stats[id]["intelligence"] = 10;
        stats[id]["creativity"] = 10;
        stats[id]["resilience"] = 10;
        exists[id] = true;
        allIds.push(id);
        ownerEntities[owner].push(id);
        totalEntities++;
        emit EntityCreated(id, name, t, owner);
        return id;
    }

    function gainExperience(bytes32 id, uint256 amount) public onlyOwner(id) mustExist(id) {
        EntityData storage e = entities[id];
        require(e.active);
        e.experience += amount;
        e.lastActive = block.timestamp;
        while (e.experience >= e.level * XP_PER_LEVEL) {
            e.experience -= e.level * XP_PER_LEVEL;
            e.level++;
            stats[id]["strength"] += 2;
            stats[id]["intelligence"] += 2;
            stats[id]["creativity"] += 1;
            stats[id]["resilience"] += 2;
            e.health = 100;
            emit EntityLeveledUp(id, e.level);
        }
    }

    function updateHealth(bytes32 id, uint256 h) public onlyOwner(id) mustExist(id) {
        require(h <= 100);
        entities[id].health = h;
        entities[id].lastActive = block.timestamp;
        if (h == 0) entities[id].active = false;
        emit EntityHealthUpdated(id, h);
    }

    function transferOwnership(bytes32 id, address to) public onlyOwner(id) mustExist(id) {
        require(to != address(0));
        address from = entities[id].owner;
        entities[id].owner = to;
        bytes32[] storage list = ownerEntities[from];
        for (uint i = 0; i < list.length; i++) {
            if (list[i] == id) { list[i] = list[list.length - 1]; list.pop(); break; }
        }
        ownerEntities[to].push(id);
        emit EntityTransferred(id, from, to);
    }

    function getStat(bytes32 id, string memory s) public view mustExist(id) returns (uint256) {
        return stats[id][s];
    }
}

/* ════════════════════════════════════════════
   ۴. MISSION REWARDS
════════════════════════════════════════════ */
interface IARZA {
    function rewardMission(address player, uint256 amount, string memory t, uint256 d) external;
}
interface INFT {
    function mintMissionNFT(address to, string memory t, string memory title, uint256 d) external returns (uint256);
}

contract MissionRewards {
    address public admin;
    IARZA public arza;
    INFT public nft;

    enum Status { Available, Active, Completed, Expired, Failed }

    struct Mission {
        bytes32 id; address player; string missionType; string title; string description;
        uint256 difficulty; uint256 rewardARZA; uint256 rewardXP; string nftName;
        uint256 duration; uint256 createdAt; uint256 startedAt; uint256 completedAt;
        Status status; bool nftMinted;
    }

    mapping(bytes32 => Mission) public missions;
    mapping(address => bytes32[]) public playerMissions;
    mapping(address => uint256) public completedCount;
    mapping(address => uint256) public playerLevel;
    bytes32[] public allIds;
    uint256 public totalMissions;
    uint256 public totalRewards;

    event MissionCreated(bytes32 indexed id, address player, string t, uint256 diff);
    event MissionCompleted(bytes32 indexed id, address player, uint256 arza, uint256 nftId);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier onlyPlayer(bytes32 id) { require(missions[id].player == msg.sender, "Not owner"); _; }

    constructor(address _arza, address _nft) {
        admin = msg.sender;
        arza = IARZA(_arza);
        nft = INFT(_nft);
    }

    function createMission(
        address player, string memory mType, string memory title, string memory desc,
        uint256 diff, uint256 reward, uint256 xp, string memory nftName, uint256 days_
    ) public onlyAdmin returns (bytes32) {
        require(player != address(0) && diff >= 1 && diff <= 10 && reward > 0);
        bytes32 id = keccak256(abi.encodePacked(player, mType, block.timestamp, totalMissions));
        missions[id] = Mission(id, player, mType, title, desc, diff, reward, xp, nftName,
            days_ * 1 days, block.timestamp, 0, 0, Status.Available, false);
        allIds.push(id);
        playerMissions[player].push(id);
        totalMissions++;
        emit MissionCreated(id, player, mType, diff);
        return id;
    }

    function startMission(bytes32 id) public onlyPlayer(id) {
        require(missions[id].status == Status.Available);
        missions[id].status = Status.Active;
        missions[id].startedAt = block.timestamp;
    }

    function completeMission(bytes32 id) public onlyPlayer(id) returns (uint256 nftId) {
        Mission storage m = missions[id];
        require(m.status == Status.Active && block.timestamp <= m.startedAt + m.duration);
        m.status = Status.Completed;
        m.completedAt = block.timestamp;
        arza.rewardMission(m.player, m.rewardARZA, m.missionType, m.difficulty);
        totalRewards += m.rewardARZA;
        nftId = 0;
        if (bytes(m.nftName).length > 0) {
            nftId = nft.mintMissionNFT(m.player, m.missionType, m.title, m.difficulty);
            m.nftMinted = true;
        }
        completedCount[m.player]++;
        playerLevel[m.player] = 1 + completedCount[m.player] / 5;
        emit MissionCompleted(id, m.player, m.rewardARZA, nftId);
    }

    function getAdjustedDifficulty(address p) public view returns (uint256) {
        uint256 r = 1 + playerLevel[p] / 2 + completedCount[p] / 10;
        return r > 10 ? 10 : r;
    }
}

/* ════════════════════════════════════════════
   ۵. DAO GOVERNANCE
════════════════════════════════════════════ */
interface IARZABal {
    function balanceOf(address) external view returns (uint256);
}

contract DAOGovernance {
    address public admin;
    IARZABal public arza;
    address public treasury;
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant MIN_PROPOSAL = 1000 * 10**8;
    uint256 public proposalCount;

    enum State { Pending, Active, Succeeded, Defeated, Executed, Cancelled }

    struct Proposal {
        uint256 id; address proposer; string title; string description;
        address target; bytes callData;
        uint256 forVotes; uint256 againstVotes;
        uint256 startTime; uint256 endTime;
        bool executed; bool cancelled;
    }

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(address => uint256) public reputation;
    mapping(address => bool) public isGovernor;

    event ProposalCreated(uint256 indexed id, address proposer, string title);
    event VoteCast(uint256 indexed id, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }

    constructor(address _arza, address _treasury) {
        admin = msg.sender;
        arza = IARZABal(_arza);
        treasury = _treasury;
        isGovernor[msg.sender] = true;
    }

    function propose(string memory title, string memory desc, address target, bytes memory data) public returns (uint256) {
        require(arza.balanceOf(msg.sender) >= MIN_PROPOSAL || isGovernor[msg.sender], "Threshold");
        proposalCount++;
        proposals[proposalCount] = Proposal(proposalCount, msg.sender, title, desc, target, data,
            0, 0, block.timestamp, block.timestamp + VOTING_PERIOD, false, false);
        emit ProposalCreated(proposalCount, msg.sender, title);
        return proposalCount;
    }

    function castVote(uint256 id, bool support) public {
        Proposal storage p = proposals[id];
        require(block.timestamp >= p.startTime && block.timestamp <= p.endTime && !p.cancelled);
        require(!hasVoted[id][msg.sender]);
        uint256 weight = (arza.balanceOf(msg.sender) / 10**8) + reputation[msg.sender] * 10 + 1;
        hasVoted[id][msg.sender] = true;
        if (support) p.forVotes += weight; else p.againstVotes += weight;
        reputation[msg.sender] += 1;
        emit VoteCast(id, msg.sender, support, weight);
    }

    function execute(uint256 id) public {
        Proposal storage p = proposals[id];
        require(block.timestamp > p.endTime && !p.executed && !p.cancelled);
        require(p.forVotes > p.againstVotes);
        p.executed = true;
        if (p.target != address(0) && p.callData.length > 0) {
            (bool ok,) = p.target.call(p.callData);
            require(ok, "Exec failed");
        }
        reputation[p.proposer] += 10;
        emit ProposalExecuted(id);
    }

    function getState(uint256 id) public view returns (State) {
        Proposal storage p = proposals[id];
        if (p.cancelled) return State.Cancelled;
        if (p.executed) return State.Executed;
        if (block.timestamp < p.startTime) return State.Pending;
        if (block.timestamp <= p.endTime) return State.Active;
        return p.forVotes > p.againstVotes ? State.Succeeded : State.Defeated;
    }

    function setGovernor(address a, bool s) public onlyAdmin { isGovernor[a] = s; }
}

/* ════════════════════════════════════════════
   ۶. TREASURY
════════════════════════════════════════════ */
interface IARZATransfer {
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

contract Treasury {
    address public admin;
    IARZATransfer public arza;
    mapping(address => bool) public isTreasurer;
    uint256 public totalReceived;
    uint256 public totalSpent;
    uint256 public developmentBudget;
    uint256 public rewardBudget;
    uint256 public eventBudget;
    uint256 public reserveBudget;
    uint256 public requiredApprovals = 2;
    uint256 public requestCount;

    struct SpendRequest {
        address recipient; uint256 amount; string category; string reason;
        address requester; uint256 approvals; bool executed; bool cancelled;
    }
    mapping(uint256 => SpendRequest) public requests;
    mapping(uint256 => mapping(address => bool)) public approved;

    event SpendRequested(uint256 indexed id, address to, uint256 amount);
    event SpendExecuted(uint256 indexed id, address to, uint256 amount);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier onlyTreasurer() { require(isTreasurer[msg.sender] || msg.sender == admin, "Not treasurer"); _; }

    constructor(address _arza) {
        admin = msg.sender;
        arza = IARZATransfer(_arza);
        isTreasurer[msg.sender] = true;
    }

    function recordReceive(uint256 amount, string memory) public onlyTreasurer {
        totalReceived += amount;
        reserveBudget += amount;
    }

    function requestSpend(address to, uint256 amount, string memory cat, string memory reason) public onlyTreasurer returns (uint256) {
        requestCount++;
        requests[requestCount] = SpendRequest(to, amount, cat, reason, msg.sender, 0, false, false);
        emit SpendRequested(requestCount, to, amount);
        return requestCount;
    }

    function approveSpend(uint256 id) public onlyTreasurer {
        SpendRequest storage r = requests[id];
        require(!r.executed && !r.cancelled && !approved[id][msg.sender]);
        approved[id][msg.sender] = true;
        r.approvals++;
        if (r.approvals >= requiredApprovals) {
            require(arza.balanceOf(address(this)) >= r.amount, "Low balance");
            r.executed = true;
            totalSpent += r.amount;
            if (keccak256(bytes(r.category)) == keccak256("development")) developmentBudget -= r.amount;
            else if (keccak256(bytes(r.category)) == keccak256("reward")) rewardBudget -= r.amount;
            else if (keccak256(bytes(r.category)) == keccak256("event")) eventBudget -= r.amount;
            else reserveBudget -= r.amount;
            require(arza.transfer(r.recipient, r.amount), "Transfer fail");
            emit SpendExecuted(id, r.recipient, r.amount);
        }
    }

    function allocateBudget(uint256 dev, uint256 reward, uint256 evt, uint256 reserve) public onlyAdmin {
        require(dev + reward + evt + reserve <= arza.balanceOf(address(this)));
        developmentBudget = dev;
        rewardBudget = reward;
        eventBudget = evt;
        reserveBudget = reserve;
    }

    function getBalance() public view returns (uint256) { return arza.balanceOf(address(this)); }
    function setTreasurer(address a, bool s) public onlyAdmin { isTreasurer[a] = s; }
}

/* ════════════════════════════════════════════
   ۷. NFT INTELLIGENCE
════════════════════════════════════════════ */
contract NFTIntelligence {
    address public admin;
    address public missionContract;
    string public name = "Suraya Intelligent NFT";
    string public symbol = "sNFT";

    enum NFTType { Mission, Character, Land, Item, Achievement, Art }

    struct NFT {
        uint256 id; address owner; NFTType nftType; string title; string description;
        string missionType; uint256 difficulty; uint256 level; uint256 intelligence;
        uint256 createdAt; uint256 lastEvolved; bool soulbound; string uri;
    }

    mapping(uint256 => NFT) public nfts;
    mapping(uint256 => mapping(string => string)) public attributes;
    mapping(address => uint256[]) public ownerTokens;
    mapping(uint256 => address) public tokenOwner;
    mapping(uint256 => address) public tokenApprovals;
    mapping(address => mapping(address => bool)) public operatorApprovals;

    uint256 public totalSupply;
    uint256 public nextId = 1;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event NFTMinted(uint256 indexed id, address to, NFTType t, string title);
    event NFTEvolved(uint256 indexed id, uint256 level, uint256 intelligence);

    modifier onlyAdmin() { require(msg.sender == admin, "Only admin"); _; }
    modifier onlyOwnerOf(uint256 id) { require(tokenOwner[id] == msg.sender, "Not owner"); _; }

    constructor() { admin = msg.sender; }

    function balanceOf(address o) public view returns (uint256) { return ownerTokens[o].length; }
    function ownerOf(uint256 id) public view returns (address) {
        require(tokenOwner[id] != address(0), "Not exist");
        return tokenOwner[id];
    }

    function mintMissionNFT(address to, string memory mType, string memory title, uint256 diff) public returns (uint256) {
        require(msg.sender == admin || msg.sender == missionContract, "Auth");
        uint256 id = nextId++;
        totalSupply++;
        uint256 intel = 50 + diff * 5;
        if (intel > 100) intel = 100;
        nfts[id] = NFT(id, to, NFTType.Mission, title, string(abi.encodePacked("پاداش: ", title)),
            mType, diff, 1, intel, block.timestamp, block.timestamp, false, "");
        tokenOwner[id] = to;
        ownerTokens[to].push(id);
        emit Transfer(address(0), to, id);
        emit NFTMinted(id, to, NFTType.Mission, title);
        return id;
    }

    function mintCharacter(address to, string memory title, string memory desc, bool soul) public onlyAdmin returns (uint256) {
        uint256 id = nextId++;
        totalSupply++;
        nfts[id] = NFT(id, to, NFTType.Character, title, desc, "", 0, 1, 60, block.timestamp, block.timestamp, soul, "");
        tokenOwner[id] = to;
        ownerTokens[to].push(id);
        emit Transfer(address(0), to, id);
        emit NFTMinted(id, to, NFTType.Character, title);
        return id;
    }

    function evolve(uint256 id) public onlyOwnerOf(id) {
        NFT storage n = nfts[id];
        require(block.timestamp >= n.lastEvolved + 7 days, "Cooldown");
        n.level++;
        uint256 gain = 5 + n.difficulty / 2;
        n.intelligence = n.intelligence + gain > 100 ? 100 : n.intelligence + gain;
        n.lastEvolved = block.timestamp;
        emit NFTEvolved(id, n.level, n.intelligence);
    }

    function transferFrom(address from, address to, uint256 id) public {
        require(tokenOwner[id] == from && to != address(0));
        require(msg.sender == from || tokenApprovals[id] == msg.sender || operatorApprovals[from][msg.sender]);
        require(!nfts[id].soulbound, "Soulbound");
        delete tokenApprovals[id];
        uint256[] storage list = ownerTokens[from];
        for (uint i = 0; i < list.length; i++) {
            if (list[i] == id) { list[i] = list[list.length - 1]; list.pop(); break; }
        }
        tokenOwner[id] = to;
        nfts[id].owner = to;
        ownerTokens[to].push(id);
        emit Transfer(from, to, id);
    }

    function setMissionContract(address c) public onlyAdmin { missionContract = c; }
    function tokensOfOwner(address o) public view returns (uint256[] memory) { return ownerTokens[o]; }
}
/**
 * ═══════════════════════════════════════════════════════════════
 * SURAYA WORLD ENGINE  –  همهٔ جهان و بازی در یک فایل
 * ═══════════════════════════════════════════════════════════════
 * ۱. BaseEntity
 * ۲. موجودیت‌های طبیعی (خاک، آب، باد، آتش، نور)
 * ۳. MissionSystem (۷ نوع مأموریت)
 * ۴. مدیریت مراکز و زمین (مرکزیت اصلی + مراکز شهری یکپارچه)
 * ═══════════════════════════════════════════════════════════════
 *
 * ساختار مدیریتی:
 * - مرکزیت اصلی جهان → فقط متعلق به مالک (admin)
 * - زمین مرکزی هر شهر → شبکه مدیریتی یکپارچه
 * - ابلاغ قوانین از مراکز به کل جهان
 * - سند زمین برای بازیکنان بر اساس فعالیت
 * - اختیار کامل مالک برای هر تغییر
 * - کارمندان مراکز: فعلاً تعریف نشده (آینده)
 */

'use strict';

/* ─────────────────────────────────────────────
   ۱. BASE ENTITY
───────────────────────────────────────────── */
class BaseEntity {
  constructor({ id, name, type, element = null, owner = null }) {
    this.id = id || `e-\( {Date.now()}- \){Math.random().toString(36).slice(2, 7)}`;
    this.name = name;
    this.type = type;
    this.element = element;
    this.owner = owner;
    this.health = 100;
    this.level = 1;
    this.experience = 0;
    this.lastActive = Date.now();
    this.active = true;
    this.position = { x: 0, y: 0, z: 0 };
    this.stats = { strength: 10, intelligence: 10, creativity: 10, resilience: 10 };
    this.history = [];
  }

  tick(world) {
    this.lastActive = Date.now();
    this._env(world);
    if (this.health < 100 && this.active) this.health = Math.min(100, this.health + 0.1);
  }

  _env(world) {
    if (!world?.weather) return;
    const { temperature, humidity } = world.weather;
    if (this.element === 'آتش' && temperature < 0) this.health = Math.max(0, this.health - 1);
    if (this.element === 'آب' && humidity < 20) this.health = Math.max(0, this.health - 0.5);
  }

  gainExperience(n) {
    this.experience += n;
    while (this.experience >= this.level * 100) {
      this.experience -= this.level * 100;
      this.level++;
      this.stats.strength += 2;
      this.stats.intelligence += 2;
      this.stats.creativity += 1;
      this.stats.resilience += 2;
      this.health = 100;
      this.history.push({ event: 'level_up', level: this.level, at: Date.now() });
    }
  }

  takeDamage(n) {
    this.health = Math.max(0, this.health - n);
    if (this.health === 0) { this.active = false; this.history.push({ event: 'down', at: Date.now() }); }
  }

  heal(n) { this.health = Math.min(100, this.health + n); this.active = true; }

  toJSON() {
    return {
      id: this.id, name: this.name, type: this.type, element: this.element,
      owner: this.owner, health: this.health, level: this.level, experience: this.experience,
      lastActive: this.lastActive, active: this.active, position: this.position, stats: this.stats
    };
  }
}

/* ─────────────────────────────────────────────
   ۲. موجودیت‌های طبیعی
───────────────────────────────────────────── */

/** 🌍 خاک‌دانه */
class Torbaq extends BaseEntity {
  constructor(opts = {}) {
    super({ name: opts.name || 'خاک‌دانه', type: 'natural', element: 'خاک', ...opts });
    this.fertility = 80;
    this.moisture = 50;
    this.crops = [];
  }
  plant(seed, amount = 1) {
    if (this.fertility < 20) return { success: false, reason: 'خاک ضعیف' };
    this.crops.push({ type: seed, amount, plantedAt: Date.now(), growth: 0 });
    this.fertility -= 2;
    this.gainExperience(5);
    return { success: true, count: this.crops.length };
  }
  harvest() {
    const ready = this.crops.filter(c => c.growth >= 100);
    if (!ready.length) return { success: false, yield: 0 };
    const y = ready.reduce((s, c) => s + c.amount * (this.fertility / 50), 0);
    this.crops = this.crops.filter(c => c.growth < 100);
    this.fertility = Math.min(100, this.fertility + 5);
    this.gainExperience(20);
    return { success: true, yield: Math.floor(y) };
  }
  tick(w) {
    super.tick(w);
    this.crops.forEach(c => { c.growth = Math.min(100, c.growth + this.moisture / 20 + this.fertility / 50); });
    if (w?.weather?.rain) this.moisture = Math.min(100, this.moisture + 10);
    else this.moisture = Math.max(0, this.moisture - 1);
  }
  toJSON() { return { ...super.toJSON(), fertility: this.fertility, moisture: this.moisture, crops: this.crops }; }
}

/** 💧 آب‌دولت */
class AbDolat extends BaseEntity {
  constructor(opts = {}) {
    super({ name: opts.name || 'آب‌دولت', type: 'natural', element: 'آب', ...opts });
    this.waterLevel = 80;
    this.purity = 90;
    this.wells = [];
    this.distribution = 0;
    this.sustainability = 70;
  }
  digWell(cap = 100) {
    if (this.waterLevel < 15) return { success: false, reason: 'آب کم' };
    const well = { id: `w-${Date.now()}`, capacity: cap, current: cap * 0.8, at: Date.now(), active: true };
    this.wells.push(well);
    this.waterLevel = Math.max(0, this.waterLevel - 5);
    this.distribution = Math.min(100, this.distribution + 8);
    this.gainExperience(15);
    return { success: true, well, total: this.wells.length };
  }
  distribute(amount) {
    let avail = this.wells.reduce((s, w) => s + (w.active ? w.current : 0), 0);
    if (avail < amount) return { success: false, available: avail };
    let left = amount;
    for (const w of this.wells) {
      if (!w.active || left <= 0) continue;
      const take = Math.min(w.current, left);
      w.current -= take; left -= take;
    }
    this.sustainability = Math.min(100, this.sustainability + 2);
    this.gainExperience(10);
    return { success: true, distributed: amount };
  }
  tick(w) {
    super.tick(w);
    if (w?.weather?.rain) {
      this.waterLevel = Math.min(100, this.waterLevel + 12);
      this.wells.forEach(x => { if (x.active) x.current = Math.min(x.capacity, x.current + 15); });
    } else this.waterLevel = Math.max(0, this.waterLevel - 0.5);
    if (w?.weather?.drought) {
      this.waterLevel = Math.max(0, this.waterLevel - 3);
      this.sustainability = Math.max(0, this.sustainability - 2);
    }
  }
  toJSON() {
    return { ...super.toJSON(), waterLevel: this.waterLevel, purity: this.purity,
      wells: this.wells, distribution: this.distribution, sustainability: this.sustainability };
  }
}

/** 🌬️ باد‌نواز */
class Kulekci extends BaseEntity {
  constructor(opts = {}) {
    super({ name: opts.name || 'باد‌نواز', type: 'natural', element: 'باد', ...opts });
    this.windSpeed = 30;
    this.direction = 0;
    this.energy = 50;
    this.seedDispersion = 0;
    this.turbines = [];
  }
  boostWind(f = 10) {
    this.windSpeed = Math.min(120, this.windSpeed + f);
    this.energy = Math.min(100, this.energy + f * 0.8);
    this.gainExperience(8);
    return { windSpeed: this.windSpeed, energy: this.energy };
  }
  disperseSeeds(n = 20) {
    if (this.windSpeed < 15) return { success: false, reason: 'باد ضعیف' };
    this.seedDispersion += n;
    this.gainExperience(12);
    return { success: true, total: this.seedDispersion };
  }
  installTurbine(power = 50) {
    this.turbines.push({ id: `t-${Date.now()}`, power, at: Date.now(), active: true, generated: 0 });
    this.gainExperience(20);
    return { success: true, total: this.turbines.length };
  }
  harvestEnergy() {
    let total = 0;
    for (const t of this.turbines) {
      if (!t.active) continue;
      const g = (this.windSpeed / 100) * t.power;
      t.generated += g; total += g;
    }
    this.energy = Math.max(0, this.energy - total * 0.1);
    if (total > 0) this.gainExperience(Math.floor(total / 5));
    return { harvested: Math.floor(total) };
  }
  tick(w) {
    super.tick(w);
    this.windSpeed = Math.max(5, Math.min(100, this.windSpeed + (Math.random() - 0.5) * 10));
    this.direction = (this.direction + (Math.random() - 0.5) * 20 + 360) % 360;
    if (w?.weather?.storm) { this.windSpeed = Math.min(120, this.windSpeed + 40); this.takeDamage(2); }
  }
  toJSON() {
    return { ...super.toJSON(), windSpeed: this.windSpeed, direction: this.direction,
      energy: this.energy, seedDispersion: this.seedDispersion, turbines: this.turbines };
  }
}

/** 🔥 آتش‌خیز */
class Ates extends BaseEntity {
  constructor(opts = {}) {
    super({ name: opts.name || 'آتش‌خیز', type: 'natural', element: 'آتش', ...opts });
    this.temperature = 400;
    this.intensity = 50;
    this.fuel = 70;
    this.controlled = true;
    this.forges = [];
  }
  ignite(f = 10) {
    if (this.fuel < f) return { success: false, reason: 'سوخت کم' };
    this.fuel -= f;
    this.intensity = Math.min(100, this.intensity + f * 2);
    this.temperature = Math.min(1200, this.temperature + f * 15);
    this.gainExperience(10);
    return { success: true, intensity: this.intensity, temperature: this.temperature };
  }
  forge(item, temp = 600) {
    if (this.temperature < temp || this.intensity < 30)
      return { success: false, reason: 'دما یا شدت کافی نیست' };
    this.fuel = Math.max(0, this.fuel - 5);
    this.intensity = Math.max(0, this.intensity - 10);
    this.gainExperience(25);
    const p = { name: item, at: Date.now(), quality: Math.min(100, 50 + this.intensity / 2) };
    this.forges.push(p);
    return { success: true, product: p };
  }
  tick(w) {
    super.tick(w);
    if (this.intensity > 0) {
      this.fuel = Math.max(0, this.fuel - 0.3);
      this.intensity = Math.max(0, this.intensity - 0.5);
    }
    if (w?.weather?.rain) {
      this.intensity = Math.max(0, this.intensity - 15);
      this.temperature = Math.max(20, this.temperature - 50);
    }
  }
  toJSON() {
    return { ...super.toJSON(), temperature: this.temperature, intensity: this.intensity,
      fuel: this.fuel, controlled: this.controlled, forges: this.forges };
  }
}

/** ☀️ نور‌مهر */
class Nur extends BaseEntity {
  constructor(opts = {}) {
    super({ name: opts.name || 'نور‌مهر', type: 'natural', element: 'نور', ...opts });
    this.brightness = 70;
    this.solarEnergy = 60;
    this.dayCycle = 0.5;
    this.panels = [];
    this.blessing = 0;
  }
  radiate(p = 15) {
    this.brightness = Math.min(100, this.brightness + p);
    this.solarEnergy = Math.min(100, this.solarEnergy + p * 0.7);
    this.blessing += p * 0.5;
    this.gainExperience(8);
    return { brightness: this.brightness, solarEnergy: this.solarEnergy };
  }
  installPanel(cap = 40) {
    this.panels.push({ id: `p-${Date.now()}`, capacity: cap, efficiency: 0.85, at: Date.now(), generated: 0, active: true });
    this.gainExperience(18);
    return { success: true, total: this.panels.length };
  }
  harvestSolar() {
    let total = 0;
    for (const p of this.panels) {
      if (!p.active) continue;
      const g = this.brightness * 0.01 * p.capacity * p.efficiency * this.dayCycle;
      p.generated += g; total += g;
    }
    if (total > 0) this.gainExperience(Math.floor(total / 4));
    return { harvested: Math.floor(total) };
  }
  tick(w) {
    super.tick(w);
    const hour = (Date.now() / 3600000) % 24;
    this.dayCycle = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
    this.brightness = Math.floor(this.dayCycle * 100);
    if (w?.weather?.cloudy) this.brightness = Math.floor(this.brightness * 0.4);
  }
  toJSON() {
    return { ...super.toJSON(), brightness: this.brightness, solarEnergy: this.solarEnergy,
      dayCycle: this.dayCycle, panels: this.panels, blessing: this.blessing };
  }
}

/* ─────────────────────────────────────────────
   ۳. MISSION SYSTEM
───────────────────────────────────────────── */
class MissionSystem {
  constructor(blockchain) {
    this.blockchain = blockchain;
    this.missions = new Map();
    this.progress = new Map();
  }

  _make(partial) {
    const m = {
      id: partial.type + '-' + Date.now(),
      status: 'available',
      createdAt: Date.now(),
      ...partial
    };
    this.missions.set(m.id, m);
    return m;
  }

  createFarming() {
    return this._make({
      type: 'farming', entity: 'خاک‌دانه', title: 'کشاورزی و بذرپاشی',
      description: 'یک مزرعهٔ دیجیتال را پرورش دهید',
      objective: { plant: 100, harvest: 80, yield: 500 },
      difficulty: 3, duration: 7,
      rewards: { arza: 1000, experience: 500, trophies: ['کشاورز ماهر'] }
    });
  }
  createWater() {
    return this._make({
      type: 'water_management', entity: 'آب‌دولت', title: 'مدیریت منابع آبی',
      description: 'چاه‌ها را حفر کنید و آب توزیع کنید',
      objective: { wells: 5, distribution: 100, sustainability: 80 },
      difficulty: 4, duration: 14,
      rewards: { arza: 2000, experience: 1000, items: ['مجوز چاه‌کن'] }
    });
  }
  createTrading() {
    return this._make({
      type: 'trading', entity: 'بازرگان‌ی', title: 'تجارت بین‌شهری',
      description: 'کالا بخرید و بفروشید و سود کنید',
      objective: { trades: 20, profit: 5000, reputation: 100 },
      difficulty: 3, duration: 30,
      rewards: { arza: 3000, experience: 2000, nft: 'تمبر بازرگان' }
    });
  }
  createBuilding() {
    return this._make({
      type: 'construction', entity: 'کار‌خانه‌ای', title: 'ساخت کارخانه',
      description: 'کارخانه هوشمند راه‌اندازی کنید',
      objective: { buildingLevel: 3, production: 100, efficiency: 90 },
      difficulty: 5, duration: 21,
      rewards: { arza: 5000, experience: 3000, nft: 'کارخانه‌دار' }
    });
  }
  createGovernance() {
    return this._make({
      type: 'governance', entity: 'پادشاه‌نشین', title: 'حکمرانی',
      description: 'شهری را اداره کنید و قانون بسازید',
      objective: { laws: 5, happiness: 80, prosperity: 70 },
      difficulty: 5, duration: 60,
      rewards: { arza: 10000, experience: 5000, nft: 'تاج‌سوار' }
    });
  }
  createScholar() {
    return this._make({
      type: 'education', entity: 'دانش‌ورز', title: 'تحقیق علمی',
      description: 'فناوری جدید کشف کنید',
      objective: { research: 10, innovation: 100, publications: 5 },
      difficulty: 4, duration: 45,
      rewards: { arza: 4000, experience: 3000, nft: 'استاد دانش' }
    });
  }
  createArtist() {
    return this._make({
      type: 'culture', entity: 'هنرمند‌پال', title: 'آفرینش هنری',
      description: 'اثر هنری بسازید و بفروشید',
      objective: { artworks: 10, appreciation: 500, influence: 100 },
      difficulty: 3, duration: 30,
      rewards: { arza: 2000, experience: 1500, nft: 'اثر هنری' }
    });
  }

  async complete(playerId, missionId) {
    const m = this.missions.get(missionId);
    if (!m) throw new Error('مأموریت یافت نشد');
    const tx = this.blockchain.recordMissionCompletion({
      playerId, missionId, rewards: m.rewards
    });
    let nftMinted = false;
    if (m.rewards.nft) {
      this.blockchain.mintNFT(playerId, m.rewards.nft);
      nftMinted = true;
    }
    m.status = 'completed';
    return { success: true, rewards: m.rewards, tx: tx.hash, nftMinted };
  }

  random() {
    const fns = [
      this.createFarming, this.createWater, this.createTrading,
      this.createBuilding, this.createGovernance, this.createScholar, this.createArtist
    ];
    return fns[Math.floor(Math.random() * fns.length)].call(this);
  }

  available() {
    return [...this.missions.values()].filter(m => m.status === 'available');
  }
}

/* ─────────────────────────────────────────────
   ۴. مدیریت مراکز و زمین
───────────────────────────────────────────── */
class WorldManagement {
  constructor(adminId = 'ADMIN') {
    this.adminId = adminId;
    this.globalCenter = {
      id: 'GLOBAL_CENTER',
      name: 'مرکزیت اصلی جهان ثریا',
      owner: adminId,
      isCentral: true,
      active: true,
      establishedAt: Date.now()
    };
    this.cities = new Map();
    this.lands = new Map();
    this.decrees = [];
    this.ownerLands = new Map();

    this.lands.set('GLOBAL_CENTER', {
      id: 'GLOBAL_CENTER',
      cityId: null,
      owner: adminId,
      title: 'مرکزیت اصلی جهان ثریا',
      isCentral: true,
      isDeeded: true,
      valueScore: 10000,
      deededAt: Date.now(),
      active: true
    });
    this.ownerLands.set(adminId, ['GLOBAL_CENTER']);
  }

  registerCity({ id, name, country, lat, lng, population = 0 }) {
    const cityId = id || `city-${Date.now()}`;
    const centralLandId = `center-${cityId}`;

    this.lands.set(centralLandId, {
      id: centralLandId,
      cityId,
      owner: this.adminId,
      title: `مرکز مدیریتی شهر ${name}`,
      isCentral: true,
      isDeeded: true,
      valueScore: 5000,
      deededAt: Date.now(),
      active: true
    });

    const list = this.ownerLands.get(this.adminId) || [];
    list.push(centralLandId);
    this.ownerLands.set(this.adminId, list);

    this.cities.set(cityId, {
      id: cityId,
      name,
      country,
      lat,
      lng,
      population,
      prosperity: 50,
      active: true,
      registeredAt: Date.now(),
      centralLandId
    });

    return { cityId, centralLandId };
  }

  deedLand({ cityId, playerId, title, valueScore = 100 }) {
    const landId = `land-\( {playerId}- \){Date.now()}`;
    this.lands.set(landId, {
      id: landId,
      cityId: cityId || null,
      owner: playerId,
      title,
      isCentral: false,
      isDeeded: true,
      valueScore,
      deededAt: Date.now(),
      active: true
    });
    const list = this.ownerLands.get(playerId) || [];
    list.push(landId);
    this.ownerLands.set(playerId, list);
    return landId;
  }

  issueDecree({ title, content, originCenterId }) {
    const land = this.lands.get(originCenterId);
    if (!land || !land.isCentral) throw new Error('فقط از مراکز مدیریتی قابل ابلاغ است');
    const decree = {
      id: this.decrees.length + 1,
      title,
      content,
      originCenter: originCenterId,
      issuedAt: Date.now(),
      active: true
    };
    this.decrees.push(decree);
    return decree;
  }

  adminChangeRule(ruleName, details) {
    return {
      rule: ruleName,
      details,
      changedBy: this.adminId,
      at: Date.now()
    };
  }

  getCityCentral(cityId) {
    return this.cities.get(cityId)?.centralLandId || null;
  }

  getOwnerLands(ownerId) {
    return (this.ownerLands.get(ownerId) || []).map(id => this.lands.get(id));
  }
}

/* ─── Export ─── */
module.exports = {
  BaseEntity, Torbaq, AbDolat, Kulekci, Ates, Nur,
  MissionSystem, WorldManagement
};
