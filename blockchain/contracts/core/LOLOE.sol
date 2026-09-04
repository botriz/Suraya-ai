// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ╔════════════════════════════════════════════════════════════╗
 * ║                                                            ║
 * ║        ◈ لؤلؤ‌سنجش - LOLOE Pearl Token                 ║
 * ║                                                            ║
 * ║  توکن اصلی جهان دیجیتال ثریا                            ║
 * ║  نام فارسی: لؤلؤ‌سنجش (ارزش‌سنج اقتصادی)             ║
 * ║  نام ترکی: Göy Dəri (پوست آسمانی)                      ║
 * ║  Symbol: LOLOE ◈                                         ║
 * ║                                                            ║
 * ║  کاربردها:                                              ║
 * ║  1. پاداش مأموریت‌های جهان                             ║
 * ║  2. تبادل در بازار                                     ║
 * ║  3. حق رأی در تصمیمات حکومت                            ║
 * ║  4. سرمایه‌گذاری و درآمد                               ║
 * ║                                                            ║
 * ╚════════════════════════════════════════════════════════════╝
 */

contract LOLOE {
    // ============================================
    // 📊 STATE VARIABLES
    // ============================================
    
    string public constant name = "Loluye Sanjesh";
    string public constant symbol = "LOLOE";
    uint8 public constant decimals = 18;
    uint256 public totalSupply = 0;
    
    address public admin;
    
    // Balances and Allowances
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    // Roles
    mapping(address => bool) public isMinter;
    mapping(address => bool) public isBurner;
    
    // Statistics
    uint256 public totalMinted = 0;
    uint256 public totalBurned = 0;
    uint256 public totalTransferred = 0;
    
    // ============================================
    // 🎺 EVENTS
    // ============================================
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount, string reason);
    event Burn(address indexed from, uint256 amount, string reason);
    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);
    
    // ============================================
    // 🛡️ MODIFIERS
    // ============================================
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyMinter() {
        require(isMinter[msg.sender], "Only minter");
        _;
    }
    
    modifier onlyBurner() {
        require(isBurner[msg.sender], "Only burner");
        _;
    }
    
    // ============================================
    // 👤 CONSTRUCTOR
    // ============================================
    
    constructor() {
        admin = msg.sender;
        isMinter[msg.sender] = true;
        isBurner[msg.sender] = true;
    }
    
    // ============================================
    // 💰 MINT FUNCTIONS
    // ============================================
    
    function mint(address to, uint256 amount, string memory reason) public onlyMinter {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be > 0");
        
        balanceOf[to] += amount;
        totalSupply += amount;
        totalMinted += amount;
        
        emit Mint(to, amount, reason);
        emit Transfer(address(0), to, amount);
    }
    
    // ============================================
    // 🔥 BURN FUNCTIONS
    // ============================================
    
    function burn(uint256 amount, string memory reason) public onlyBurner {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        require(amount > 0, "Amount must be > 0");
        
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        totalBurned += amount;
        
        emit Burn(msg.sender, amount, reason);
        emit Transfer(msg.sender, address(0), amount);
    }
    
    // ============================================
    // 🔄 TRANSFER FUNCTIONS
    // ============================================
    
    function transfer(address to, uint256 amount) public returns (bool) {
        require(to != address(0), "Invalid address");
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        totalTransferred += amount;
        
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(from != address(0) && to != address(0), "Invalid address");
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Allowance exceeded");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        totalTransferred += amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    // ============================================
    // 🔐 ADMIN FUNCTIONS
    // ============================================
    
    function addMinter(address minter) public onlyAdmin {
        isMinter[minter] = true;
        emit MinterAdded(minter);
    }
    
    function removeMinter(address minter) public onlyAdmin {
        isMinter[minter] = false;
        emit MinterRemoved(minter);
    }
    
    function addBurner(address burner) public onlyAdmin {
        isBurner[burner] = true;
    }
    
    function removeBurner(address burner) public onlyAdmin {
        isBurner[burner] = false;
    }
    
    // ============================================
    // 📈 VIEW FUNCTIONS
    // ============================================
    
    function getStats() public view returns (
        uint256 _totalSupply,
        uint256 _totalMinted,
        uint256 _totalBurned,
        uint256 _totalTransferred,
        uint256 _circulatingSupply
    ) {
        return (
            totalSupply,
            totalMinted,
            totalBurned,
            totalTransferred,
            totalMinted - totalBurned
        );
    }
    
    function getBalance(address account) public view returns (uint256) {
        return balanceOf[account];
    }
}
