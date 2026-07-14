/**
 * 本脚本从本机受限助记词文件部署托管合约，并执行一次 fund/release 链上验收。
 * 只输出公开地址与交易哈希；助记词永不进入日志、环境变量、仓库或 VPS。
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
  await readFile(new URL("../src/generated/escrow.json", import.meta.url), "utf8"),
);
const account = mnemonicToAccount(walletBackup.mnemonic);
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});
const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http("https://rpc.testnet.arc.network"),
});

const deployHash = await walletClient.deployContract({
  abi: artifact.abi,
  bytecode: artifact.bytecode,
});
const deployReceipt = await publicClient.waitForTransactionReceipt({
  hash: deployHash,
});
if (deployReceipt.status !== "success" || !deployReceipt.contractAddress) {
  throw new Error("Escrow deployment failed");
}

const reference = keccak256(stringToHex(`arc-paylink-demo-${Date.now()}`));
const latestBlock = await publicClient.getBlock();
const refundAfter = Number(latestBlock.timestamp) + 3600;
const fundHash = await walletClient.writeContract({
  address: deployReceipt.contractAddress,
  abi: artifact.abi,
  functionName: "fund",
  args: [reference, account.address, refundAfter],
  value: parseEther("1"),
});
const fundReceipt = await publicClient.waitForTransactionReceipt({ hash: fundHash });
if (fundReceipt.status !== "success") throw new Error("Escrow funding failed");

const releaseHash = await walletClient.writeContract({
  address: deployReceipt.contractAddress,
  abi: artifact.abi,
  functionName: "release",
  args: [reference],
});
const releaseReceipt = await publicClient.waitForTransactionReceipt({
  hash: releaseHash,
});
if (releaseReceipt.status !== "success") throw new Error("Escrow release failed");

console.log(
  JSON.stringify({
    contractAddress: deployReceipt.contractAddress,
    deployHash,
    reference,
    fundHash,
    releaseHash,
    blockNumber: releaseReceipt.blockNumber.toString(),
  }),
);
