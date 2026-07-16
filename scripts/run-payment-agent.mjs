/**
 * 本脚本读取可验证的任务批准信号，并在链上策略全部通过后由 ERC-8004 Agent 身份对应钱包发起付款。
 * 默认只做 dry-run；仅显式传入 --execute 才读取测试助记词并发送 Arc Testnet 交易。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  isAddressEqual,
  keccak256,
  parseEther,
  toHex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const execute = process.argv.includes("--execute");
const root = new URL("../", import.meta.url);
const policy = JSON.parse(await readFile(new URL("config/agent-policy.example.json", root), "utf8"));
const job = JSON.parse(await readFile(new URL("config/demo-job.json", root), "utf8"));
const artifact = JSON.parse(await readFile(new URL("src/generated/agent-vault.json", root), "utf8"));
const identity = JSON.parse(await readFile(new URL("src/generated/agent-identity.json", root), "utf8"));
const outputPath = new URL(
  execute ? "public/agent-runs/latest-execution.json" : "public/agent-runs/latest-decision.json",
  root,
);
const rpcUrl = "https://rpc.blockdaemon.testnet.arc.network";
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });

const signal = {
  jobId: job.jobId,
  status: job.status,
  recipient: job.recipient,
  amount: job.amount,
  deliverableHash: job.deliverableHash,
  approvedAt: job.approvedAt,
  expiresAt: job.expiresAt,
};
const paymentId = keccak256(toHex(JSON.stringify(signal)));
const amount = parseEther(job.amount);
const now = Date.now();
const approvedAt = Date.parse(job.approvedAt);
const expiresAt = Date.parse(job.expiresAt);

const agent = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "agent" });
const totalBudget = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "totalBudget" });
const maxPerPayment = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "maxPerPayment" });
const spent = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "spent" });
const validUntil = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "validUntil" });
const revoked = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "revoked" });
const recipientAllowed = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "allowedRecipients", args: [job.recipient] });
const alreadyExecuted = await publicClient.readContract({ address: policy.vault, abi: artifact.abi, functionName: "executedPayments", args: [paymentId] });
const vaultBalance = await publicClient.getBalance({ address: policy.vault });

const checks = {
  identityMatchesPolicy: identity.agentId === policy.agentId,
  approvedStatus: job.status === policy.requiredStatus,
  validTimestamps: Number.isFinite(approvedAt) && Number.isFinite(expiresAt) && approvedAt <= now && expiresAt > now,
  freshSignal: now - approvedAt <= policy.maxSignalAgeSeconds * 1000,
  vaultActive: !revoked && Number(validUntil) * 1000 > now,
  recipientAllowed: Boolean(recipientAllowed),
  underPaymentCap: amount <= maxPerPayment,
  underTotalBudget: spent + amount <= totalBudget,
  vaultFunded: amount <= vaultBalance,
  replaySafe: !alreadyExecuted,
};
const approved = Object.values(checks).every(Boolean);
let transactionHash;
let blockNumber;

if (execute && approved) {
  const walletBackup = JSON.parse(await readFile("/Users/chendafu/.config/arc-builder/test-wallet.json", "utf8"));
  const account = mnemonicToAccount(walletBackup.mnemonic);
  if (!isAddressEqual(account.address, agent)) throw new Error("Configured wallet is not the authorized vault agent");
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });
  transactionHash = await walletClient.writeContract({
    address: policy.vault,
    abi: artifact.abi,
    functionName: "pay",
    args: [paymentId, job.recipient, amount],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
  if (receipt.status !== "success") throw new Error("Agent payment transaction failed");
  blockNumber = receipt.blockNumber.toString();
}

const result = {
  agentId: identity.agentId,
  agentAddress: agent,
  vault: policy.vault,
  jobId: job.jobId,
  deliverableHash: job.deliverableHash,
  paymentId,
  amount: `${formatEther(amount)} USDC`,
  decision: approved ? execute ? "executed" : "approved_dry_run" : "rejected",
  checks,
  transactionHash,
  blockNumber,
  evaluatedAt: new Date().toISOString(),
};
await mkdir(new URL("public/agent-runs/", root), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
