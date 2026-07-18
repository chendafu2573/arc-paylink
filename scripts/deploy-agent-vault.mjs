/**
 * 本脚本从本机受限测试助记词部署 Agent Vault，并验证正常支付、重复支付和超限支付三条路径。
 * 只使用 Arc Testnet 原生测试 USDC，日志仅包含公开地址、策略参数和交易哈希。
 */
import { readFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  stringToHex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const walletPath = "/Users/chendafu/.config/arc-builder/test-wallet.json";
const walletBackup = JSON.parse(await readFile(walletPath, "utf8"));
const artifact = JSON.parse(
  await readFile(new URL("../src/generated/agent-vault.json", import.meta.url), "utf8"),
);
const account = mnemonicToAccount(walletBackup.mnemonic);
const rpcUrl = "https://rpc.testnet.arc.network";
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

const latestBlock = await publicClient.getBlock();
const validUntil = Number(latestBlock.timestamp) + 7 * 24 * 60 * 60;
const totalBudget = parseEther("1");
const maxPerPayment = parseEther("0.1");
const initialFunding = parseEther("0.2");

const deployHash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
  args: [account.address, totalBudget, maxPerPayment, validUntil, [account.address]],
  value: initialFunding,
});
const deployReceipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
if (deployReceipt.status !== "success" || !deployReceipt.contractAddress) {
  throw new Error("Agent Vault deployment failed");
}

const paymentId = keccak256(stringToHex(`arc-agent-payment-${Date.now()}`));
const paymentAmount = parseEther("0.01");
const payHash = await walletClient.writeContract({
  address: deployReceipt.contractAddress,
  abi: artifact.abi,
  functionName: "pay",
  args: [paymentId, account.address, paymentAmount],
});
const payReceipt = await publicClient.waitForTransactionReceipt({ hash: payHash });
if (payReceipt.status !== "success") throw new Error("Agent payment failed");

let duplicateRejected = false;
try {
  await publicClient.simulateContract({
    account,
    address: deployReceipt.contractAddress,
    abi: artifact.abi,
    functionName: "pay",
    args: [paymentId, account.address, paymentAmount],
  });
} catch {
  duplicateRejected = true;
}

let overLimitRejected = false;
try {
  await publicClient.simulateContract({
    account,
    address: deployReceipt.contractAddress,
    abi: artifact.abi,
    functionName: "pay",
    args: [keccak256(stringToHex("over-limit")), account.address, parseEther("0.11")],
  });
} catch {
  overLimitRejected = true;
}

if (!duplicateRejected || !overLimitRejected) {
  throw new Error("Agent Vault policy rejection checks failed");
}

console.log(JSON.stringify({
  contractAddress: deployReceipt.contractAddress,
  owner: account.address,
  agent: account.address,
  totalBudget: "1 USDC",
  maxPerPayment: "0.1 USDC",
  initialFunding: "0.2 USDC",
  validUntil,
  deployHash,
  paymentId,
  paymentAmount: "0.01 USDC",
  payHash,
  blockNumber: payReceipt.blockNumber.toString(),
  duplicateRejected,
  overLimitRejected,
}));
