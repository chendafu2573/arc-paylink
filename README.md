<!--
本文件用于公开说明 Arc Paylink 的目标、验证方式和维护入口。
上线后应持续补充真实部署地址、交易证据和版本变更，不记录任何密钥。
-->

# Arc Paylink

Arc Paylink 是一个运行在 Arc Testnet 上的可编程 USDC 发票工具。收款人填写地址、金额和备注即可生成可分享链接；付款人可直接支付，也可把资金存入托管，确认交付后再放款。

- Live App: <https://13-212-95-171.sslip.io>
- HTTP Fallback: <http://13.212.95.171>
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
- 新付款链接默认 24 小时有效，过期后在签名前阻止支付
- 生成付款二维码
- 使用注入式 EVM 钱包签名原生 USDC 转账
- 受保护支付：24 小时托管、付款方确认放款、到期原路退款
- 可分享的公开订单状态链接，直接读取链上付款方、收款方、金额和状态
- Agent 策略金库：总预算、单笔上限、收款人白名单和有效期均由合约执行
- ERC-8004 Agent 身份：Settlement Agent ID `851241`
- 自主执行器：验证任务状态、信号时效、策略预算和防重放后才发起付款
- ERC-8183 标准任务：创建、定价、USDC 托管、交付物提交、评估和结算完整闭环
- Circle Gateway Nanopayment：通过 x402 支付 0.01 USDC 获取任务验证信号，单次支付无需 Gas
- 统一 Agent Receipt：交叉校验身份、策略执行、ERC-8183 结算与 x402 支付，生成稳定 SHA-256 Receipt ID，由 ERC-8004 owner 以 EIP-191 签名，并将 ID 锚定到 Arc Testnet calldata
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
| Agent Vault | `0x7af6b4261bf83823a83fa9b6614676db68a88fba` |
| ERC-8004 IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| Agent ID | `851241` |
| ERC-8183 AgenticCommerce | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| ERC-8183 Job ID | `158446` |
| Gateway x402 Transfer ID | `07c2724c-ba84-42c6-9624-c65146d24723` |

## 安全边界

应用不收集助记词或私钥。所有交易由用户钱包发起和签名。Arc Testnet USDC 没有现实货币价值。

## Builder 证据

公网地址：<https://13-212-95-171.sslip.io>；代理或 Fake-IP 环境无法访问时使用 <http://13.212.95.171>。

### 链上验证

- Faucet 入金：[20 USDC](https://testnet.arcscan.app/tx/0x9683709b1415dec48f71d3d0336466dc2df221b26c2facad96e254d9ab507e7a)
- Paylink 演示支付：[1 USDC](https://testnet.arcscan.app/tx/0x60b4a67b8e45d23e39092daccd5ae4d3c05376f3162d1c6014e14f37a81d94e8)
- 托管合约部署：[交易](https://testnet.arcscan.app/tx/0xb52ca59fe9cd59f9bec2fe57a50a3c3a8fb065b1c4dd6e6fc08671ec929714d1)
- 托管存入测试：[交易](https://testnet.arcscan.app/tx/0x8eaa28e4ac6431ff73d21b1c92338b3a1dbe3533cd5d4876c658dcd917779c74)
- 托管放款测试：[交易](https://testnet.arcscan.app/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7)
- Agent Vault 部署：[交易](https://testnet.arcscan.app/tx/0x0cdcbbc848b5ce1f63e6560f52b7e5b8d3989a54e25fc389b121c3e17d197f7a)
- 受限 Agent 付款：[0.01 USDC](https://testnet.arcscan.app/tx/0xb505a7982b5605fde9173771b182cec814efd5701265ef04205090f08d963f0f)
- ERC-8004 身份注册：[Agent #851241](https://testnet.arcscan.app/tx/0x29dbdce7da8b59b5f2917495b4b4582013079de179cd74b50f487f9590efa4bc)
- 信号驱动自主付款：[0.01 USDC](https://testnet.arcscan.app/tx/0x530b182a6e9a129873e62519629a61d02236fe52c0b22ca9fa07d38cb35fa7ad)
- ERC-8183 创建任务：[Job #158446](https://testnet.arcscan.app/tx/0x04559d66b0a81fdf1719d3ea516ed21ef20fa9390b74768359c4b71dd745461c)
- ERC-8183 提交交付物：[交易](https://testnet.arcscan.app/tx/0x2dc40f13544ce07c0fd91c30acfcc6681c59c7d6850c3dc98118fd554ebb8a67)
- ERC-8183 完成结算：[0.1 USDC](https://testnet.arcscan.app/tx/0x501e31834f57ef7f1631015c904b46db94f3b3a599f3e3849c55011e37f818b8)
- Gateway 存款：[0.5 USDC](https://testnet.arcscan.app/tx/0x6d90fc8652ebd4182c206507895c209359422ed1914ec615cb00ab71deb3a019)
- x402 Nanopayment：[公开证据](http://13.212.95.171/gateway-proof.json)
- Agent Receipt：[机器可验证的统一证明](http://13.212.95.171/agent-receipt.json)
- Receipt 链上锚点：[ArcScan 交易](https://testnet.arcscan.app/tx/0x4aab13cd9e2324d3b5bdb2b50fe80553396d1a98a80759c2345d97dc4d94557b)
- 交易状态：成功

重新生成并检查统一证明：

```bash
npm run agent:receipt
npm run agent:receipt:check
npm run agent:receipt:verify
npm run agent:receipt:anchor
```

`agent:receipt:verify` 不读取钱包文件：它仅根据公开 Receipt 重算内容摘要、恢复 EIP-191 签名地址，并核对该地址与 ERC-8004 owner 是否一致。

测试网收款地址：`0x4f9011fCba9B69Bfa839604a70434674Fbf78827`
