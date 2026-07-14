/**
 * 本脚本验证公开部署的托管合约和已完成验收订单，防止前端指向错误网络或地址。
 * 验证只读取 Arc Testnet 公共状态；更换合约时同步更新公开地址与验收订单 ID。
 */
import assert from "node:assert/strict";
import { createPublicClient, defineChain, http } from "viem";
import artifact from "../src/generated/escrow.json" with { type: "json" };

const contract = "0xcc5ae59000d5b3d1886317f7554dc5894aea6c4d";
const paymentId = "0x51a8242e1a04a1557b18a85d3e2da62d9b2eff92e1657b389ab331392b5c5c6f";
const builderWallet = "0x4f9011fCba9B69Bfa839604a70434674Fbf78827";
const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
});
const client = createPublicClient({ chain: arcTestnet, transport: http() });

const code = await client.getCode({ address: contract });
assert.ok(code && code !== "0x", "托管合约地址没有部署代码");

const payment = await client.readContract({
  address: contract,
  abi: artifact.abi,
  functionName: "payments",
  args: [paymentId],
});
const [payer, payee, amount, refundAfter, status] = payment;
assert.equal(payer.toLowerCase(), builderWallet.toLowerCase());
assert.equal(payee.toLowerCase(), builderWallet.toLowerCase());
assert.equal(amount, 1000000000000000000n);
assert.ok(refundAfter > 0n);
assert.equal(status, 2, "验收订单应处于 Released 状态");

console.log(JSON.stringify({ contract, paymentId, status: "released", network: arcTestnet.name }, null, 2));
