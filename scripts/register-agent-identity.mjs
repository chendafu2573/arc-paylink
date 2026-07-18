/**
 * 本脚本把 Arc Paylink Settlement Agent 注册到 Arc Testnet 的官方 ERC-8004 IdentityRegistry。
 * 注册结果写入公开 artifact 供前端展示；重复运行时先验证已有身份，避免重复铸造。
 */
import { readFile, writeFile } from "node:fs/promises";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const identityRegistry = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const metadataURI = "https://13-212-95-171.sslip.io/agent-metadata.json";
const walletPath = "/Users/chendafu/.config/arc-builder/test-wallet.json";
const outputPath = new URL("../src/generated/agent-identity.json", import.meta.url);
const identityAbi = parseAbi([
  "function register(string metadataURI)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
]);
const transferEvent = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);
const rpcUrl = "https://rpc.testnet.arc.network";
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });

async function existingIdentity() {
  try {
    const artifact = JSON.parse(await readFile(outputPath, "utf8"));
    const owner = await publicClient.readContract({
      address: identityRegistry,
      abi: identityAbi,
      functionName: "ownerOf",
      args: [BigInt(artifact.agentId)],
    });
    return { ...artifact, owner, reused: true };
  } catch {
    return undefined;
  }
}

const existing = await existingIdentity();
if (existing) {
  console.log(JSON.stringify(existing));
  process.exit(0);
}

const walletBackup = JSON.parse(await readFile(walletPath, "utf8"));
const account = mnemonicToAccount(walletBackup.mnemonic);
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });
const registerHash = await walletClient.writeContract({
  account,
  address: identityRegistry,
  abi: identityAbi,
  functionName: "register",
  args: [metadataURI],
});
const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
if (receipt.status !== "success") throw new Error("ERC-8004 registration failed");

const logs = await publicClient.getLogs({
  address: identityRegistry,
  event: transferEvent,
  args: { from: "0x0000000000000000000000000000000000000000", to: account.address },
  fromBlock: receipt.blockNumber,
  toBlock: receipt.blockNumber,
});
const agentId = logs[logs.length - 1]?.args.tokenId;
if (agentId == null) throw new Error("ERC-8004 registration event was not found");

const artifact = {
  registry: identityRegistry,
  agentId: agentId.toString(),
  owner: account.address,
  metadataURI,
  registerHash,
  blockNumber: receipt.blockNumber.toString(),
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ ...artifact, reused: false }));
