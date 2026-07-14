<!--
本文件汇总 Arc Paylink 对外发布所需的 Builder 说明和证据链接。
发布前按目标社区调整语气，但不得夸大空投、收益或主网可用性。
-->

# Arc Paylink Builder Submission

## 一句话介绍

Arc Paylink 把 Arc Testnet 原生 USDC 收款请求变成可分享的可编程发票：直接支付，或存入链上托管并在交付后放款。

## 解决的问题

普通钱包地址缺少金额、用途和网络上下文，容易造成误付。Arc Paylink 将收款地址、金额和备注编码进公开链接，自动完成 Arc Testnet 网络设置，并在交易确认后提供 ArcScan 证据。

## 可验证成果

- Live App: <https://13-212-95-171.sslip.io>
- Source: <https://github.com/chendafu2573/arc-paylink>
- Builder Wallet: `0x4f9011fCba9B69Bfa839604a70434674Fbf78827`
- Faucet Funding: <https://testnet.arcscan.app/tx/0x9683709b1415dec48f71d3d0336466dc2df221b26c2facad96e254d9ab507e7a>
- Escrow Contract: `0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d`
- Escrow Deployment: <https://testnet.arcscan.app/tx/0xb52ca59fe9cd59f9bec2fe57a50a3c3a8fb065b1c4dd6e6fc08671ec929714d1>
- Escrow Fund: <https://testnet.arcscan.app/tx/0x8eaa28e4ac6431ff73d21b1c92338b3a1dbe3533cd5d4876c658dcd917779c74>
- Escrow Release: <https://testnet.arcscan.app/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7>

## 技术特点

- Arc Testnet Chain ID `5042002`
- 原生 USDC 作为支付与 Gas Token
- Viem 钱包和 RPC 集成
- 收款链接与二维码生成
- 原生 USDC 条件托管、确认放款与超时退款
- 客户端签名，服务器不保存用户私钥
- Caddy 自动 HTTPS 与静态部署

## English post draft

Built Arc Paylink on Arc Testnet — programmable native USDC invoices with direct payments or delivery-protected escrow.

The payer signs in their own wallet, the server never handles user keys, and escrow settlement is enforced and verifiable onchain.

Live: https://13-212-95-171.sslip.io

Escrow contract: 0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d

Built to explore practical stablecoin payment UX on Arc—not transaction farming.
