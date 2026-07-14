<!--
本文件记录 Arc Hackathon 的产品取舍与可验证依据，避免后续迭代退化为刷交互。
维护时只记录官方规则、实际链上证据和明确假设，不把潜在空投描述为确定收益。
-->

# Arc Paylink Hackathon Strategy

## 当前事实

- Arc 没有公开测试网积分或代币空投规则。
- Programmable Money Hackathon 明确要求可用 MVP、Arc 部署、Circle 工具、公开仓库、三分钟视频和 Deck。
- DeFi Track 明确偏好 conditional payments、onchain automation、multi-step settlement，以及 App Kits 等 Circle 产品。

## 产品升级

Arc Paylink 从简单转账链接升级为可编程 USDC 发票：

1. Direct：普通原生 USDC 支付。
2. Protect：付款进入托管合约，付款方确认交付后释放。
3. Refund：超过发票期限仍未释放时，任何人都可触发原路退款。
4. Split：后续版本加入多方分账，用于团队、创作者和平台代理费。
5. Crosschain：Checkpoint 2 前评估 App Kit Bridge，让付款人从其他支持链补充 Arc USDC。

## 评审叙事

Arc Paylink 不是钱包 UI，而是自由职业者、小商家和数字服务的可编程结算层：收款链接负责分发业务上下文，Arc 原生 USDC 负责计价和 Gas，合约负责执行条件，ArcScan 负责提供公开证据。
