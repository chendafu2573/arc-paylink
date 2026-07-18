/**
 * 本脚本在 Arc 官方 AgenticCommerce 合约上完成 ERC-8183 创建、定价、托管、交付和结算全流程。
 * client/evaluator 与 provider 使用同一测试助记词派生的不同地址；仅输出公开地址、Job ID 和交易哈希。
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  parseEther,
  parseUnits,
  toHex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const agenticCommerce = "0x0747EEf0706327138c69792bF28Cd525089e4583";
const usdc = "0x3600000000000000000000000000000000000000";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const rpcUrl = "https://rpc.blockdaemon.testnet.arc.network";
const root = new URL("../", import.meta.url);
const config = JSON.parse(await readFile(new URL("config/erc8183-job.example.json", root), "utf8"));
const walletBackup = JSON.parse(await readFile("/Users/chendafu/.config/arc-builder/test-wallet.json", "utf8"));
const client = mnemonicToAccount(walletBackup.mnemonic, { addressIndex: 0 });
const provider = mnemonicToAccount(walletBackup.mnemonic, { addressIndex: 1 });
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
const clientWallet = createWalletClient({ account: client, chain: arcTestnet, transport: http(rpcUrl) });
const providerWallet = createWalletClient({ account: provider, chain: arcTestnet, transport: http(rpcUrl) });
const commerceAbi = parseAbi([
  "function createJob(address provider,address evaluator,uint256 expiredAt,string description,address hook) returns (uint256 jobId)",
  "function setBudget(uint256 jobId,uint256 amount,bytes optParams)",
  "function fund(uint256 jobId,bytes optParams)",
  "function submit(uint256 jobId,bytes32 deliverable,bytes optParams)",
  "function complete(uint256 jobId,bytes32 reason,bytes optParams)",
  "function getJob(uint256 jobId) view returns ((uint256 id,address client,address provider,address evaluator,string description,uint256 budget,uint256 expiredAt,uint8 status,address hook))",
  "event JobCreated(uint256 indexed jobId,address indexed client,address indexed provider,address evaluator,uint256 expiredAt,address hook)",
]);
const usdcAbi = parseAbi(["function approve(address spender,uint256 amount) returns (bool)"]);
const statuses = ["Open", "Funded", "Submitted", "Completed", "Rejected", "Expired"];

try {
  const existing = JSON.parse(await readFile(new URL("src/generated/erc8183-job.json", root), "utf8"));
  const existingJob = await publicClient.readContract({
    address: agenticCommerce,
    abi: commerceAbi,
    functionName: "getJob",
    args: [BigInt(existing.jobId)],
  });
  if (Number(existingJob.status) === 3) {
    console.log(JSON.stringify({ ...existing, reused: true }));
    process.exit(0);
  }
} catch {
  // 没有可复用的已完成任务时才进入新的测试网生命周期。
}

async function confirmed(hash, label) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} failed`);
  return receipt;
}

const providerMinimumGas = parseEther("0.05");
const providerBalance = await publicClient.getBalance({ address: provider.address });
let providerFundingHash;
if (providerBalance < providerMinimumGas) {
  providerFundingHash = await clientWallet.sendTransaction({
    account: client,
    to: provider.address,
    value: providerMinimumGas - providerBalance,
  });
  await confirmed(providerFundingHash, "provider gas funding");
}

const latestBlock = await publicClient.getBlock();
const expiredAt = latestBlock.timestamp + BigInt(config.expirySeconds);
const createHash = await clientWallet.writeContract({
  account: client,
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "createJob",
  args: [provider.address, client.address, expiredAt, config.description, zeroAddress],
});
const createReceipt = await confirmed(createHash, "createJob");
let jobId;
for (const log of createReceipt.logs) {
  try {
    const decoded = decodeEventLog({ abi: commerceAbi, data: log.data, topics: log.topics });
    if (decoded.eventName === "JobCreated") jobId = decoded.args.jobId;
  } catch {
    continue;
  }
}
if (jobId == null) throw new Error("JobCreated event was not found");

const budget = parseUnits(config.budget, 6);
const setBudgetHash = await providerWallet.writeContract({
  account: provider,
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "setBudget",
  args: [jobId, budget, "0x"],
});
await confirmed(setBudgetHash, "setBudget");

const approveHash = await clientWallet.writeContract({
  account: client,
  address: usdc,
  abi: usdcAbi,
  functionName: "approve",
  args: [agenticCommerce, budget],
});
await confirmed(approveHash, "approve");

const fundHash = await clientWallet.writeContract({
  account: client,
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "fund",
  args: [jobId, "0x"],
});
await confirmed(fundHash, "fund");

const deliverableHash = keccak256(toHex(config.deliverable));
const submitHash = await providerWallet.writeContract({
  account: provider,
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "submit",
  args: [jobId, deliverableHash, "0x"],
});
await confirmed(submitHash, "submit");

const reasonHash = keccak256(toHex(config.completionReason));
const completeHash = await clientWallet.writeContract({
  account: client,
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "complete",
  args: [jobId, reasonHash, "0x"],
});
const completeReceipt = await confirmed(completeHash, "complete");
const job = await publicClient.readContract({
  address: agenticCommerce,
  abi: commerceAbi,
  functionName: "getJob",
  args: [jobId],
});
if (Number(job.status) !== 3) throw new Error(`Unexpected final job status: ${job.status}`);

const result = {
  standard: "ERC-8183",
  contract: agenticCommerce,
  agentId: config.agentId,
  jobId: jobId.toString(),
  client: client.address,
  provider: provider.address,
  evaluator: client.address,
  description: job.description,
  budget: `${formatUnits(job.budget, 6)} USDC`,
  status: statuses[Number(job.status)],
  deliverableHash,
  reasonHash,
  transactions: {
    providerFunding: providerFundingHash,
    create: createHash,
    setBudget: setBudgetHash,
    approve: approveHash,
    fund: fundHash,
    submit: submitHash,
    complete: completeHash,
  },
  completionBlock: completeReceipt.blockNumber.toString(),
};
await writeFile(new URL("src/generated/erc8183-job.json", root), `${JSON.stringify(result, null, 2)}\n`);
await writeFile(new URL("public/erc8183-job.json", root), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result));
