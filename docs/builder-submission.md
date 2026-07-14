<!--
本文件汇总 Arc Paylink 对外发布所需的 Builder 说明和证据链接。
发布前按目标社区调整语气，但不得夸大空投、收益或主网可用性。
-->

# Arc Paylink Builder Submission

## 一句话介绍

Arc Paylink 把 Arc Testnet 原生 USDC 收款请求变成可分享的链接和二维码，付款人始终在自己的钱包中签名。

## 解决的问题

普通钱包地址缺少金额、用途和网络上下文，容易造成误付。Arc Paylink 将收款地址、金额和备注编码进公开链接，自动完成 Arc Testnet 网络设置，并在交易确认后提供 ArcScan 证据。

## 可验证成果

- Live App: <https://13-212-95-171.sslip.io>
- Source: 待 GitHub 发布后补充
- Builder Wallet: `0x4f9011fCba9B69Bfa839604a70434674Fbf78827`
- Faucet Funding: <https://testnet.arcscan.app/tx/0x9683709b1415dec48f71d3d0336466dc2df221b26c2facad96e254d9ab507e7a>
- Demo Payment: <https://testnet.arcscan.app/tx/0x60b4a67b8e45d23e39092daccd5ae4d3c05376f3162d1c6014e14f37a81d94e8>

## 技术特点

- Arc Testnet Chain ID `5042002`
- 原生 USDC 作为支付与 Gas Token
- Viem 钱包和 RPC 集成
- 收款链接与二维码生成
- 客户端签名，服务器不保存用户私钥
- Caddy 自动 HTTPS 与静态部署

## English post draft

Built Arc Paylink on Arc Testnet — a lightweight way to turn native USDC payment requests into shareable links and QR codes.

The payer signs in their own wallet, the server never handles user keys, and every payment is verifiable on ArcScan.

Live: https://13-212-95-171.sslip.io

Demo transaction: https://testnet.arcscan.app/tx/0x60b4a67b8e45d23e39092daccd5ae4d3c05376f3162d1c6014e14f37a81d94e8

Built to explore practical stablecoin payment UX on Arc—not transaction farming.
