/**
 * 本文件用于把稳定 Receipt ID 写入 Arc Testnet 交易 calldata，提供公开时间戳和不可抵赖锚点。
 * 核心逻辑是零金额自调用、验证交易输入与成功状态并复用已有锚点；维护时不得改成向第三方转账或重复广播。
 */
import { readFile, writeFile } from "node:fs/promises";
import { createPublicClient, createWalletClient, http, stringToHex } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { arcTestnet } from "viem/chains";

const root = new URL("../", import.meta.url);
const walletPath = process.env.ARC_TEST_WALLET_PATH ?? "/Users/chendafu/.config/arc-builder/test-wallet.json";
const receiptPath = new URL("public/agent-receipt.json", root);
const outputPaths = [
  new URL("public/agent-receipt-anchor.json", root),
  new URL("src/generated/agent-receipt-anchor.json", root),
];
const rpcUrl = "https://rpc.testnet.arc.network";
const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const anchorMessage = `${receipt.schema}|${receipt.receiptId}`;
const anchorData = stringToHex(anchorMessage);

async function verifyAnchor(anchor) {
  if (anchor.receiptId !== receipt.receiptId || anchor.data !== anchorData) return undefined;
  const [transaction, transactionReceipt] = await Promise.all([
    publicClient.getTransaction({ hash: anchor.transactionHash }),
    publicClient.getTransactionReceipt({ hash: anchor.transactionHash }),
  ]);
  if (
    transactionReceipt.status !== "success" ||
    transaction.input !== anchorData ||
    transaction.value !== 0n ||
    transaction.from.toLowerCase() !== receipt.agent.owner.toLowerCase() ||
    transaction.to?.toLowerCase() !== receipt.agent.owner.toLowerCase()
  ) return undefined;
  return { ...anchor, blockNumber: transactionReceipt.blockNumber.toString(), verified: true };
}

try {
  const existing = JSON.parse(await readFile(outputPaths[0], "utf8"));
  const verified = await verifyAnchor(existing);
  if (verified) {
    process.stdout.write(`${JSON.stringify({ ...verified, reused: true }, null, 2)}\n`);
    process.exit(0);
  }
} catch {
  // 没有可验证的既有锚点时才广播交易。
}

const walletBackup = JSON.parse(await readFile(walletPath, "utf8"));
const account = mnemonicToAccount(walletBackup.mnemonic, { path: walletBackup.derivationPath });
if (account.address.toLowerCase() !== receipt.agent.owner.toLowerCase()) {
  throw new Error("Anchor signer does not match the ERC-8004 owner");
}

const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });
const transactionHash = await walletClient.sendTransaction({
  account,
  to: account.address,
  value: 0n,
  data: anchorData,
});
const transactionReceipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });
if (transactionReceipt.status !== "success") throw new Error("Receipt anchor transaction failed");

const anchor = {
  scheme: "arc-calldata-v1",
  network: "eip155:5042002",
  receiptId: receipt.receiptId,
  message: anchorMessage,
  data: anchorData,
  from: account.address,
  to: account.address,
  value: "0",
  transactionHash,
  blockNumber: transactionReceipt.blockNumber.toString(),
  explorerUrl: `${arcTestnet.blockExplorers.default.url}/tx/${transactionHash}`,
  verified: true,
};
const serialized = `${JSON.stringify(anchor, null, 2)}\n`;
await Promise.all(outputPaths.map((outputPath) => writeFile(outputPath, serialized)));
process.stdout.write(`${JSON.stringify({ ...anchor, reused: false }, null, 2)}\n`);
