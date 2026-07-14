<!--
本文件用于公开说明 Arc Paylink 的目标、验证方式和维护入口。
上线后应持续补充真实部署地址、交易证据和版本变更，不记录任何密钥。
-->

# Arc Paylink

Arc Paylink 是一个运行在 Arc Testnet 上的可编程 USDC 发票工具。收款人填写地址、金额和备注即可生成可分享链接；付款人可直接支付，也可把资金存入托管，确认交付后再放款。

- Live App: <https://13-212-95-171.sslip.io>
- Live Proof: <https://13-212-95-171.sslip.io/?escrow=0x51a8242e1a04a1557b18a85d3e2da62d9b2eff92e1657b389ab331392b5c5c6f>
- Builder Submission: [docs/builder-submission.md](docs/builder-submission.md)
- Checkpoint Draft: [docs/checkpoint-submission.md](docs/checkpoint-submission.md)
- Demo Script: [docs/demo-script.md](docs/demo-script.md)
- Pitch Deck: [outputs/arc-paylink-pitch.pptx](outputs/arc-paylink-pitch.pptx)
- Demo Video: [outputs/arc-paylink-demo.mp4](outputs/arc-paylink-demo.mp4)

## 为什么做这个项目

小商户、自由职业者和 AI Agent 需要一个比复制钱包地址更清晰的收款体验。Arc 以 USDC 作为原生 Gas Token，适合把金额明确、链上可验证的支付请求压缩成一个链接。

## 当前功能

- 自动添加并切换 Arc Testnet
- 创建带收款地址、金额和备注的付款链接
- 生成付款二维码
- 使用注入式 EVM 钱包签名原生 USDC 转账
- 受保护支付：24 小时托管、付款方确认放款、到期原路退款
- 可分享的公开订单状态链接，直接读取链上付款方、收款方、金额和状态
- 等待链上确认并跳转 ArcScan 验证
- 纯静态部署，不保存私钥和用户数据

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

验证公开部署合约与验收订单：

```bash
npm run contract:verify
```

## 网络参数

| 参数 | 值 |
| --- | --- |
| 网络 | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| 原生货币 | USDC（18 decimals） |
| 浏览器 | `https://testnet.arcscan.app` |
| Faucet | `https://faucet.circle.com` |
| 托管合约 | `0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d` |

## 安全边界

应用不收集助记词或私钥。所有交易由用户钱包发起和签名。Arc Testnet USDC 没有现实货币价值。

## Builder 证据

公网地址：<https://13-212-95-171.sslip.io>

### 链上验证

- Faucet 入金：[20 USDC](https://testnet.arcscan.app/tx/0x9683709b1415dec48f71d3d0336466dc2df221b26c2facad96e254d9ab507e7a)
- Paylink 演示支付：[1 USDC](https://testnet.arcscan.app/tx/0x60b4a67b8e45d23e39092daccd5ae4d3c05376f3162d1c6014e14f37a81d94e8)
- 托管合约部署：[交易](https://testnet.arcscan.app/tx/0xb52ca59fe9cd59f9bec2fe57a50a3c3a8fb065b1c4dd6e6fc08671ec929714d1)
- 托管存入测试：[交易](https://testnet.arcscan.app/tx/0x8eaa28e4ac6431ff73d21b1c92338b3a1dbe3533cd5d4876c658dcd917779c74)
- 托管放款测试：[交易](https://testnet.arcscan.app/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7)
- 交易状态：成功

测试网收款地址：`0x4f9011fCba9B69Bfa839604a70434674Fbf78827`
