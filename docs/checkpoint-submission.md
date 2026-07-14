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
- Delivery-protected escrow with release and timeout refund
- Onchain order recovery after page refresh
- Shareable public order-status links backed by direct contract reads
- Public contract, source repository, and ArcScan evidence
- Automated verification of deployed bytecode and released test order

## Links

- Live: https://13-212-95-171.sslip.io
- Live proof: https://13-212-95-171.sslip.io/?escrow=0x51a8242e1a04a1557b18a85d3e2da62d9b2eff92e1657b389ab331392b5c5c6f
- Source: https://github.com/chendafu2573/arc-paylink
- Demo video: https://github.com/chendafu2573/arc-paylink/blob/main/outputs/arc-paylink-demo.mp4
- Contract: https://testnet.arcscan.app/address/0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d
- Fund transaction: https://testnet.arcscan.app/tx/0x8eaa28e4ac6431ff73d21b1c92338b3a1dbe3533cd5d4876c658dcd917779c74
- Release transaction: https://testnet.arcscan.app/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7

## Next milestone

Complete the recorded demo, add invoice history and split settlement, gather user feedback from the Arc community, and polish the final submission.
