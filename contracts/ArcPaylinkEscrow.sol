// 本合约让 Arc Paylink 支持原生 USDC 条件托管，解决陌生交易双方的履约信任问题。
// 核心状态只有充值、释放和到期退款；维护时任何新路径都必须先更新状态再转账。
// 该版本仅用于 Arc Testnet 演示，未经安全审计，不得部署到主网承载真实资金。
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ArcPaylinkEscrow {
    enum Status {
        None,
        Funded,
        Released,
        Refunded
    }

    struct Payment {
        address payer;
        address payable payee;
        uint128 amount;
        uint64 refundAfter;
        Status status;
    }

    error InvalidPayment();
    error PaymentAlreadyExists();
    error PaymentNotFunded();
    error OnlyPayer();
    error RefundNotAvailable();
    error TransferFailed();
    error ReentrantCall();

    mapping(bytes32 paymentId => Payment payment) public payments;

    uint256 public lockedBalance;
    bool private entered;

    event PaymentFunded(
        bytes32 indexed paymentId,
        address indexed payer,
        address indexed payee,
        uint256 amount,
        uint64 refundAfter
    );
    event PaymentReleased(bytes32 indexed paymentId, uint256 amount);
    event PaymentRefunded(bytes32 indexed paymentId, uint256 amount);

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    function fund(
        bytes32 paymentId,
        address payable payee,
        uint64 refundAfter
    ) external payable {
        if (
            paymentId == bytes32(0) ||
            payee == address(0) ||
            msg.value == 0 ||
            msg.value > type(uint128).max ||
            refundAfter <= block.timestamp
        ) revert InvalidPayment();
        if (payments[paymentId].status != Status.None) {
            revert PaymentAlreadyExists();
        }

        payments[paymentId] = Payment({
            payer: msg.sender,
            payee: payee,
            amount: uint128(msg.value),
            refundAfter: refundAfter,
            status: Status.Funded
        });
        lockedBalance += msg.value;

        emit PaymentFunded(
            paymentId,
            msg.sender,
            payee,
            msg.value,
            refundAfter
        );
    }

    function release(bytes32 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert PaymentNotFunded();
        if (msg.sender != payment.payer) revert OnlyPayer();

        uint256 amount = payment.amount;
        payment.status = Status.Released;
        lockedBalance -= amount;

        (bool sent, ) = payment.payee.call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit PaymentReleased(paymentId, amount);
    }

    function refund(bytes32 paymentId) external nonReentrant {
        Payment storage payment = payments[paymentId];
        if (payment.status != Status.Funded) revert PaymentNotFunded();
        if (block.timestamp < payment.refundAfter) revert RefundNotAvailable();

        uint256 amount = payment.amount;
        payment.status = Status.Refunded;
        lockedBalance -= amount;

        (bool sent, ) = payable(payment.payer).call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit PaymentRefunded(paymentId, amount);
    }

    receive() external payable {
        revert InvalidPayment();
    }
}
