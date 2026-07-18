/**
 * 本脚本在本机启动 x402 付费 API，并让 Arc Paylink Agent 通过 Circle Gateway 完成 0.01 USDC Nanopayment。
 * 私钥只从本机测试助记词临时派生，不写入文件或日志；已有成功证据会被复用，避免重复扣款。
 */
import { readFile, writeFile } from "node:fs/promises";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync } from "@scure/bip39";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import express from "express";
import { formatUnits, toHex } from "viem";

const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("config/gateway-agent.example.json", root), "utf8"));
const walletBackup = JSON.parse(await readFile("/Users/chendafu/.config/arc-builder/test-wallet.json", "utf8"));
const erc8183Job = JSON.parse(await readFile(new URL("src/generated/erc8183-job.json", root), "utf8"));
const outputPath = new URL("src/generated/gateway-proof.json", root);
const publicOutputPath = new URL("public/gateway-proof.json", root);
const seed = mnemonicToSeedSync(walletBackup.mnemonic);
const privateKeyBytes = HDKey.fromMasterSeed(seed).derive("m/44'/60'/0'/0/0").privateKey;
if (!privateKeyBytes) throw new Error("Unable to derive Gateway buyer key");
const privateKey = toHex(privateKeyBytes);
const client = new GatewayClient({
  chain: config.chain,
  privateKey,
  rpcUrl: "https://rpc.blockdaemon.testnet.arc.network",
});
if (client.address.toLowerCase() !== walletBackup.address.toLowerCase()) {
  throw new Error("Derived Gateway buyer does not match the configured test wallet");
}

try {
  const existing = JSON.parse(await readFile(outputPath, "utf8"));
  const transfer = await client.getTransferById(existing.transferId);
  if (["received", "batched", "confirmed", "completed"].includes(transfer.status)) {
    console.log(JSON.stringify({ ...existing, transferStatus: transfer.status, reused: true }));
    process.exit(0);
  }
} catch {
  // 没有可验证的既有付款时，才继续创建新的 Nanopayment。
}

const before = await client.getBalances();
const minimumAvailable = BigInt(Math.round(Number(config.minimumAvailable) * 1_000_000));
let deposit;
if (before.gateway.available < minimumAvailable) {
  deposit = await client.deposit(config.depositAmount);
  for (let attempt = 0; attempt < 30; attempt++) {
    const current = await client.getBalances();
    if (current.gateway.available >= minimumAvailable) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

const app = express();
app.use(express.json());
const gateway = createGatewayMiddleware({
  sellerAddress: erc8183Job.provider,
  facilitatorUrl: "https://gateway-api-testnet.circle.com",
  networks: [config.network],
  description: "Arc Paylink verified settlement signal",
});
app.get(config.resourcePath, gateway.require(config.paymentPrice), (request, response) => {
  response.json({
    signal: "erc8183-job-completed",
    jobId: erc8183Job.jobId,
    agentId: erc8183Job.agentId,
    deliverableHash: erc8183Job.deliverableHash,
    paidBy: request.payment?.payer,
  });
});

const server = await new Promise((resolve) => {
  const instance = app.listen(3402, "127.0.0.1", () => resolve(instance));
});

try {
  const resourceUrl = `http://127.0.0.1:3402${config.resourcePath}`;
  const support = await client.supports(resourceUrl);
  if (!support.supported) throw new Error(`Gateway batching is not supported: ${support.error ?? "unknown reason"}`);
  const payment = await client.pay(resourceUrl);
  if (payment.status !== 200) throw new Error(`Nanopayment returned HTTP ${payment.status}`);
  const after = await client.getBalances();
  const transfer = await client.getTransferById(payment.transaction);
  const result = {
    product: "Circle Gateway Nanopayments",
    protocol: "x402",
    chain: "Arc Testnet",
    network: config.network,
    agentId: erc8183Job.agentId,
    buyer: client.address,
    seller: erc8183Job.provider,
    resource: config.resourcePath,
    amount: payment.formattedAmount,
    httpStatus: payment.status,
    response: payment.data,
    transferId: payment.transaction,
    transferStatus: transfer.status,
    depositTxHash: deposit?.depositTxHash,
    approvalTxHash: deposit?.approvalTxHash,
    gatewayBalanceBefore: formatUnits(before.gateway.available, 6),
    gatewayBalanceAfter: formatUnits(after.gateway.available, 6),
    verifiedAt: new Date().toISOString(),
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  await writeFile(publicOutputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
