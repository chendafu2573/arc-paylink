<!--
本文件用于三分钟 Hackathon 演示录制，确保产品价值、链上流程和证据在有限时间内完整出现。
录制时按实际页面操作，不宣称主网可用、审计完成或存在确定空投。
-->

# Arc Paylink — 3-minute agentic demo script

## 0:00–0:20 — Problem

Autonomous payments need more than a wallet. A useful agent must identify itself, obey spending policy, settle work, and verify the result before paying for it.

## 0:20–0:45 — Product

Arc Paylink is a programmable USDC settlement product on Arc. It combines human payment links and delivery escrow with ERC-8004 Agent #851241, a policy-bounded Agent Vault, ERC-8183 jobs, and Circle Gateway x402 Nanopayments.

## 0:45–1:20 — Bounded execution

Open the live app and show Agent #851241. Its vault has a recipient allowlist, a one-USDC total budget, a 0.1-USDC per-payment cap, a seven-day expiry, and replay protection. Show the successful autonomous payment and the rejected duplicate and over-limit paths.

## 1:20–1:55 — Work settlement

Show ERC-8183 Job #158446. A separate provider accepted a 0.1-USDC budget, the client funded escrow, the provider submitted a deliverable hash, and the evaluator completed the job. Open the creation, submission, and settlement transactions on ArcScan.

## 1:55–2:30 — Machine verification and payment

Open the Gateway proof. The agent deposited 0.5 test USDC, encountered an x402-protected resource, and autonomously paid 0.01 USDC to retrieve the verified Job #158446 settlement signal. The response changed from HTTP 402 to 200 and the Gateway transfer was received without an extra buyer gas transaction.

## 2:30–3:00 — Why this matters

Arc and Circle make the complete loop composable: ERC-8004 identity, bounded Arc execution, ERC-8183 work settlement, and Gateway x402 payment all use USDC. The application, source, transactions, metadata, decision logs, job evidence, and machine-readable payment proof are public today.
