// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title RealEstate Investment Contract
 * @author 
 * @notice This contract allows users to invest ETH in a tokenized real estate system and earn returns over time.
 * @dev Production-ready: includes reentrancy guard, access control, emergency pause, safe math, gas optimization, and events
 */

contract RealEstate {
    // ==================== STATE VARIABLES ====================

    address public owner;              // Contract owner
    uint256 public totalInvestments;   // Total ETH invested in the contract
    uint256 public investorCount;      // Total number of investors
    uint256 public minimumInvestment;  // Minimum investment allowed
    uint256 public returnRate;         // Annual return rate (in basis points, 1000 = 10%)
    bool public investmentOpen;        // Flag to allow/disallow new investments
    bool private locked;               // Reentrancy guard
    bool public paused;                // Emergency pause flag

    // Investor structure (optimized for gas)
   // Investor structure (optimized for gas)
struct Investor {
    uint128 amountInvested;       // ETH invested by user
    uint64 investmentTime;        
    uint128 accumulatedReturns;   // Returns already calculated (renamed from 'returns')
    bool hasWithdrawn;            // True if full investment withdrawn
    bool exists;                  // True if investor exists
}


    mapping(address => Investor) public investors; // Map addresses to investors
    address[] private investorList;                // List of all investors

    // ==================== EVENTS ====================
    event InvestmentReceived(address indexed investor, uint256 amount, uint256 timestamp);
    event ReturnsCalculated(
    address indexed investor,
    uint256 calculatedReturns,  // renamed from 'returns'
    uint256 timestamp
);

    event ReturnsWithdrawn(address indexed investor, uint256 amount, uint256 timestamp);
    event InvestmentWithdrawn(address indexed investor, uint256 totalAmount, uint256 timestamp);
    event InvestmentStatusChanged(bool status);
    event MinimumInvestmentUpdated(uint256 newMinimum);
    event ReturnRateUpdated(uint256 newRate);
    event ContractPaused(bool status);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    // ==================== MODIFIERS ====================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier whenPaused() {
        require(paused, "Contract is not paused");
        _;
    }

    modifier investmentIsOpen() {
        require(investmentOpen, "Investment period is closed");
        _;
    }

    modifier hasInvested() {
        require(investors[msg.sender].exists, "No investment found for caller");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrancy detected");
        locked = true;
        _;
        locked = false;
    }

    modifier validAddress(address _addr) {
        require(_addr != address(0), "Invalid address");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    /**
     * @notice Initializes the contract
     * @param _minimumInvestment Minimum ETH to invest
     * @param _returnRate Annual return rate in basis points (1000 = 10%)
     */
    constructor(uint256 _minimumInvestment, uint256 _returnRate) {
        require(_minimumInvestment > 0, "Minimum investment must be > 0");
        require(_returnRate > 0 && _returnRate <= 10000, "Return rate invalid");

        owner = msg.sender;
        minimumInvestment = _minimumInvestment;
        returnRate = _returnRate;
        investmentOpen = true;
        paused = false;
        locked = false;
        totalInvestments = 0;
        investorCount = 0;
    }

    // ==================== INVESTMENT FUNCTIONS ====================

    /**
     * @notice Invest ETH into the contract
     */
    function invest() external payable whenNotPaused investmentIsOpen nonReentrant {
        require(msg.value >= minimumInvestment, "Investment below minimum");
        require(msg.value > 0, "Investment must be > 0");

        Investor storage investor = investors[msg.sender];

        // New investor
        if (!investor.exists) {
            investor.amountInvested = uint128(msg.value);
            investor.investmentTime = uint64(block.timestamp);
            investor.accumulatedReturns = 0;
            investor.hasWithdrawn = false;
            investor.exists = true;

            investorList.push(msg.sender);
            investorCount++;
        } else {
            // Add to existing investment
            investor.amountInvested += uint128(msg.value);
        }

        totalInvestments += msg.value;

        emit InvestmentReceived(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Calculate returns for a given investor
     * @param investorAddress Address of the investor
     */
    function calculateReturns(address investorAddress) public view returns (uint256) {
        Investor memory investor = investors[investorAddress];

        if (!investor.exists || investor.amountInvested == 0) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - investor.investmentTime;

        uint256 annualReturn = (uint256(investor.amountInvested) * returnRate) / 10000;

        uint256 calculatedReturns = (annualReturn * timeElapsed) / 365 days;

        return calculatedReturns;
    }

    /**
     * @notice Update returns for a specific investor (owner only)
     */
    function updateReturns(address investorAddress) public onlyOwner whenNotPaused {
        require(investors[investorAddress].exists, "Investor not found");

        Investor storage investor = investors[investorAddress];
        uint256 newReturns = calculateReturns(investorAddress);

        investor.accumulatedReturns = uint128(newReturns);

        emit ReturnsCalculated(investorAddress, newReturns, block.timestamp);
    }

    /**
     * @notice Update returns for multiple investors in batch (owner only)
     */
    function batchUpdateReturns(address[] calldata addresses) external onlyOwner whenNotPaused {
        require(addresses.length > 0, "Empty array");
        require(addresses.length <= 100, "Batch too large");

        for (uint256 i = 0; i < addresses.length; i++) {
            if (investors[addresses[i]].exists) {
                updateReturns(addresses[i]);
            }
        }
    }

    /**
     * @notice Update returns for all investors (owner only)
     * @dev Gas intensive; prefer batchUpdateReturns for many investors
     */
    function updateAllReturns() external onlyOwner whenNotPaused {
        require(investorCount > 0, "No investors");
        require(investorCount <= 100, "Too many investors, use batchUpdateReturns");

        for (uint256 i = 0; i < investorList.length; i++) {
            address investorAddr = investorList[i];
            if (investors[investorAddr].exists && !investors[investorAddr].hasWithdrawn) {
                updateReturns(investorAddr);
            }
        }
    }

    // ==================== WITHDRAWAL FUNCTIONS ====================

    /**
     * @notice Withdraw only calculated returns
     */
    function withdrawReturns() external whenNotPaused hasInvested nonReentrant {
        Investor storage investor = investors[msg.sender];

        uint256 totalReturns = calculateReturns(msg.sender);
        require(totalReturns > 0, "No returns to withdraw");
        require(address(this).balance >= totalReturns, "Insufficient contract balance");

        // Update state before sending ETH
        investor.accumulatedReturns = 0;
        investor.investmentTime = uint64(block.timestamp);

        (bool success, ) = payable(msg.sender).call{value: totalReturns}("");
        require(success, "Transfer failed");

        emit ReturnsWithdrawn(msg.sender, totalReturns, block.timestamp);
    }

    /**
     * @notice Withdraw full investment plus returns (only when investment closed)
     */
    function withdrawInvestment() external whenNotPaused hasInvested nonReentrant {
        require(!investmentOpen, "Cannot withdraw while investment is open");

        Investor storage investor = investors[msg.sender];
        uint256 totalAmount = uint256(investor.amountInvested) + calculateReturns(msg.sender);
        require(address(this).balance >= totalAmount, "Insufficient balance");

        totalInvestments -= investor.amountInvested;
        investor.amountInvested = 0;
        investor.accumulatedReturns = 0;
        investor.hasWithdrawn = true;

        (bool success, ) = payable(msg.sender).call{value: totalAmount}("");
        require(success, "Transfer failed");

        emit InvestmentWithdrawn(msg.sender, totalAmount, block.timestamp);
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get investor details
     */
    function getInvestorInfo(address investorAddress)
        external
        view
        returns (
            uint256 amountInvested,
            uint256 investmentTime,
            uint256 storedReturns,
            uint256 calculatedReturns,
            uint256 totalValue,
            bool hasWithdrawn,
            bool exists
        )
    {
        Investor memory investor = investors[investorAddress];
        uint256 calcReturns = calculateReturns(investorAddress);

        return (
            investor.amountInvested,
            investor.investmentTime,
            investor.accumulatedReturns,
            calcReturns,
            investor.amountInvested + calcReturns,
            investor.hasWithdrawn,
            investor.exists
        );
    }

    function getContractStats()
        external
        view
        returns (
            uint256 _totalInvestments,
            uint256 _investorCount,
            uint256 _contractBalance,
            uint256 _minimumInvestment,
            uint256 _returnRate,
            bool _investmentOpen,
            bool _paused
        )
    {
        return (
            totalInvestments,
            investorCount,
            address(this).balance,
            minimumInvestment,
            returnRate,
            investmentOpen,
            paused
        );
    }

    function getAllInvestors() external view onlyOwner returns (address[] memory) {
        return investorList;
    }

    function isInvestor(address _address) external view returns (bool) {
        return investors[_address].exists;
    }

    // ==================== OWNER FUNCTIONS ====================

    function setInvestmentStatus(bool status) external onlyOwner {
        investmentOpen = status;
        emit InvestmentStatusChanged(status);
    }

    function setMinimumInvestment(uint256 newMinimum) external onlyOwner {
        require(newMinimum > 0, "Minimum must be > 0");
        minimumInvestment = newMinimum;
        emit MinimumInvestmentUpdated(newMinimum);
    }

    function setReturnRate(uint256 newRate) external onlyOwner {
        require(newRate > 0 && newRate <= 10000, "Invalid rate");
        returnRate = newRate;
        emit ReturnRateUpdated(newRate);
    }

    function fundContract() external payable onlyOwner {
        require(msg.value > 0, "Must send ETH to fund");
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit ContractPaused(true);
    }

    function unpause() external onlyOwner whenPaused {
        paused = false;
        emit ContractPaused(false);
    }

    function emergencyWithdraw() external onlyOwner whenPaused nonReentrant {
        require(totalInvestments == 0, "Active investments exist");
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawal(owner, balance);
    }

    function transferOwnership(address newOwner) external onlyOwner validAddress(newOwner) {
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function renounceOwnership() external onlyOwner {
        address previousOwner = owner;
        owner = address(0);
        emit OwnershipTransferred(previousOwner, address(0));
    }

    // ==================== FALLBACK & RECEIVE ====================

    receive() external payable {
        require(msg.sender == owner, "Use invest() function");
    }

    fallback() external payable {
        revert("Use invest() function");
    }
}
