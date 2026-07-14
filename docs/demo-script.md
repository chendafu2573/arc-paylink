<!--
本文件用于三分钟 Hackathon 演示录制，确保产品价值、链上流程和证据在有限时间内完整出现。
录制时按实际页面操作，不宣称主网可用、审计完成或存在确定空投。
-->

# Arc Paylink — 3-minute demo script

## 0:00–0:25 — Problem

Stablecoin payments are fast, but a wallet address alone carries no amount, purpose, delivery condition, or protection. Freelancers and digital merchants still need a lightweight way to request payment without trusting a platform to hold their keys.

## 0:25–0:50 — Product

Arc Paylink turns a native USDC payment request into a shareable programmable invoice. The merchant enters a recipient, amount, and note, then chooses direct settlement or delivery-protected escrow.

## 0:50–1:35 — Live flow

Create a protected request for 1 USDC and copy the generated URL. Open the payment page, connect a wallet, and fund the escrow. The payer signs in their own wallet; Arc Paylink never receives the private key. Show the confirmed transaction on ArcScan.

## 1:35–2:05 — Settlement

The order card reads the actual contract state and survives a page refresh. Before expiry, the payer can confirm delivery and release the funds. After 24 hours, an unresolved payment becomes refundable to the original payer.

## 2:05–2:35 — Why Arc

Arc uses USDC as its native gas token, so payment and execution share one unit of account. The escrow contract adds conditional settlement while ArcScan provides public evidence. The application is a static client: user custody remains in the wallet and settlement rules remain onchain.

## 2:35–3:00 — Evidence and next step

The application is live, the source is public, and the deployed contract has completed an onchain fund-and-release test. Next, Arc Paylink will add reusable invoice history and programmable split settlement for teams, creators, and agentic services.
