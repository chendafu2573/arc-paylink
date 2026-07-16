<!--
本文件集中维护 Encode Club Checkpoint 可复用的英文提交内容，减少不同表单之间的表述偏差。
每次提交前核对页面、仓库和交易链接仍可访问，并按表单字数限制裁剪。
-->

# Arc Paylink — Checkpoint submission

## Project summary

Arc Paylink is a programmable native USDC invoicing app on Arc. A merchant or freelancer creates a shareable request with a recipient, amount, note, and settlement mode. The payer can settle directly or fund an onchain escrow, then release after delivery; unresolved escrow becomes refundable after 24 hours.

## Problem

A wallet address does not contain payment context or delivery conditions. Existing custodial payment platforms introduce account friction and key-management trust. Arc Paylink keeps signing in the user’s wallet while moving settlement rules into a small public contract.

## Progress

- Functional public MVP on Arc Testnet
- Direct native USDC payment links and QR codes
- Time-bounded payment requests with pre-signing expiry enforcement
- Delivery-protected escrow with release and timeout refund
- Onchain order recovery after page refresh
- Shareable public order-status links backed by direct contract reads
- Public contract, source repository, and ArcScan evidence
- Automated verification of deployed bytecode and released test order
- Three-minute product demo and pitch deck ready for review
- Agent Vault deployed with a 1 USDC budget, 0.1 USDC per-payment cap, recipient allowlist, and seven-day expiry
- Successful bounded Agent payment plus verified duplicate-ID and over-limit rejection paths
- ERC-8004 Settlement Agent registered on Arc Testnet as Agent ID 851241
- Autonomous runner checks task approval, signal freshness, vault status, recipient allowlist, budget, balance, payment cap, and replay protection before settlement
- Official ERC-8183 Job #158446 completed the full Open → Funded → Submitted → Completed lifecycle with a separate provider wallet and 0.1 USDC escrow settlement
- Circle Gateway deposited 0.5 test USDC, then Agent #851241 paid 0.01 USDC gaslessly through x402 to retrieve the verified ERC-8183 settlement signal
- Unified Agent Receipt cross-validates identity, policy execution, ERC-8183 settlement, and the x402 transfer under one stable SHA-256 receipt ID, then binds it to the ERC-8004 owner with a publicly recoverable EIP-191 signature

## Links

- Live: https://13-212-95-171.sslip.io
- HTTP fallback: http://13.212.95.171
- Live proof: https://13-212-95-171.sslip.io/?escrow=0x51a8242e1a04a1557b18a85d3e2da62d9b2eff92e1657b389ab331392b5c5c6f
- Source: https://github.com/chendafu2573/arc-paylink
- Demo video: http://13.212.95.171/arc-paylink-demo.mp4
- Pitch deck: http://13.212.95.171/arc-paylink-pitch.pptx
- Contract: https://testnet.arcscan.app/address/0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d
- Agent Vault: https://testnet.arcscan.app/address/0x7af6b4261bf83823a83fa9b6614676db68a88fba
- Agent payment: https://testnet.arcscan.app/tx/0xb505a7982b5605fde9173771b182cec814efd5701265ef04205090f08d963f0f
- ERC-8004 registration: https://testnet.arcscan.app/tx/0x29dbdce7da8b59b5f2917495b4b4582013079de179cd74b50f487f9590efa4bc
- Autonomous settlement: https://testnet.arcscan.app/tx/0x530b182a6e9a129873e62519629a61d02236fe52c0b22ca9fa07d38cb35fa7ad
- ERC-8183 job creation: https://testnet.arcscan.app/tx/0x04559d66b0a81fdf1719d3ea516ed21ef20fa9390b74768359c4b71dd745461c
- ERC-8183 deliverable: https://testnet.arcscan.app/tx/0x2dc40f13544ce07c0fd91c30acfcc6681c59c7d6850c3dc98118fd554ebb8a67
- ERC-8183 settlement: https://testnet.arcscan.app/tx/0x501e31834f57ef7f1631015c904b46db94f3b3a599f3e3849c55011e37f818b8
- Gateway deposit: https://testnet.arcscan.app/tx/0x6d90fc8652ebd4182c206507895c209359422ed1914ec615cb00ab71deb3a019
- x402 proof: http://13.212.95.171/gateway-proof.json
- Unified Agent Receipt: http://13.212.95.171/agent-receipt.json
- Fund transaction: https://testnet.arcscan.app/tx/0x8eaa28e4ac6431ff73d21b1c92338b3a1dbe3533cd5d4876c658dcd917779c74
- Release transaction: https://testnet.arcscan.app/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7

## Next milestone

Record the updated agentic demo, gather structured user feedback from the Arc community, and add reusable agent receipts that link policy decisions, ERC-8183 jobs, and x402 transfers into one portable proof object.
