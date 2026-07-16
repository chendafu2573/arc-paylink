// 本合约为 AI Agent 提供受限的 Arc 原生 USDC 支付权限，避免把无限制钱包控制权交给自动化程序。
// 核心策略由单笔上限、总预算、有效期和收款人白名单共同约束，所有限制均在链上强制执行。
// 该版本仅用于 Arc Testnet 演示，未经安全审计；维护时不得增加绕过策略的 Agent 提款路径。
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ArcPaylinkAgentVault {
    address public immutable owner;
    address public agent;
    uint128 public immutable totalBudget;
    uint128 public immutable maxPerPayment;
    uint64 public immutable validUntil;
    uint128 public spent;
    bool public revoked;
    bool private entered;

    mapping(address recipient => bool allowed) public allowedRecipients;
    mapping(bytes32 paymentId => bool executed) public executedPayments;

    error InvalidPolicy();
    error OnlyOwner();
    error OnlyAgent();
    error PolicyInactive();
    error RecipientNotAllowed();
    error PaymentLimitExceeded();
    error BudgetExceeded();
    error PaymentAlreadyExecuted();
    error TransferFailed();
    error ReentrantCall();

    event VaultFunded(address indexed sender, uint256 amount);
    event AgentPayment(
        bytes32 indexed paymentId,
        address indexed agent,
        address indexed recipient,
        uint256 amount
    );
    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event PolicyRevoked();
    event OwnerWithdrawal(uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    constructor(
        address initialAgent,
        uint128 policyBudget,
        uint128 paymentLimit,
        uint64 policyValidUntil,
        address[] memory recipients
    ) payable {
        if (
            initialAgent == address(0) ||
            policyBudget == 0 ||
            paymentLimit == 0 ||
            paymentLimit > policyBudget ||
            policyValidUntil <= block.timestamp ||
            recipients.length == 0 ||
            msg.value > policyBudget
        ) revert InvalidPolicy();

        owner = msg.sender;
        agent = initialAgent;
        totalBudget = policyBudget;
        maxPerPayment = paymentLimit;
        validUntil = policyValidUntil;

        for (uint256 index = 0; index < recipients.length; index++) {
            if (recipients[index] == address(0)) revert InvalidPolicy();
            allowedRecipients[recipients[index]] = true;
        }

        if (msg.value > 0) emit VaultFunded(msg.sender, msg.value);
    }

    function fund() external payable onlyOwner {
        if (msg.value == 0 || address(this).balance > totalBudget - spent) {
            revert BudgetExceeded();
        }
        emit VaultFunded(msg.sender, msg.value);
    }

    function pay(
        bytes32 paymentId,
        address payable recipient,
        uint128 amount
    ) external nonReentrant {
        if (msg.sender != agent) revert OnlyAgent();
        if (revoked || block.timestamp > validUntil) revert PolicyInactive();
        if (!allowedRecipients[recipient]) revert RecipientNotAllowed();
        if (paymentId == bytes32(0) || amount == 0 || amount > maxPerPayment) {
            revert PaymentLimitExceeded();
        }
        if (executedPayments[paymentId]) revert PaymentAlreadyExecuted();
        if (uint256(spent) + amount > totalBudget || amount > address(this).balance) {
            revert BudgetExceeded();
        }

        executedPayments[paymentId] = true;
        spent += amount;

        (bool sent, ) = recipient.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit AgentPayment(paymentId, msg.sender, recipient, amount);
    }

    function updateAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert InvalidPolicy();
        address previousAgent = agent;
        agent = newAgent;
        emit AgentUpdated(previousAgent, newAgent);
    }

    function revoke() external onlyOwner {
        revoked = true;
        emit PolicyRevoked();
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert BudgetExceeded();
        (bool sent, ) = payable(owner).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit OwnerWithdrawal(amount);
    }

    receive() external payable {
        revert InvalidPolicy();
    }
}
