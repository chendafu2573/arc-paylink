/**
 * 本文件用于让第三方仅凭公开 Receipt 验证内容完整性和 Agent 签名，不需要钱包或任何秘密。
 * 核心逻辑是重算稳定 SHA-256 Receipt ID、恢复 EIP-191 签名者并核对 ERC-8004 owner；维护时 schema 字段变化需同步排除外层认证字段。
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http, recoverMessageAddress, stringToHex } from "viem";
import { arcTestnet } from "viem/chains";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const receiptPath = process.argv[2] ?? path.join(root, "public/agent-receipt.json");
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function digest(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(stable(value))).digest("hex")}`;
}

function sameAddress(left, right) {
  return left.toLowerCase() === right.toLowerCase();
}

const { receiptId, issuedAt: _issuedAt, attestation, anchor, ...receiptCore } = receipt;
const computedReceiptId = digest(receiptCore);
if (computedReceiptId !== receiptId) throw new Error(`Receipt digest mismatch: ${computedReceiptId}`);
if (attestation.scheme !== "EIP-191") throw new Error(`Unsupported attestation scheme: ${attestation.scheme}`);
if (!attestation.message.includes(receiptId)) throw new Error("Attestation does not bind the Receipt ID");

const recoveredSigner = await recoverMessageAddress({
  message: attestation.message,
  signature: attestation.signature,
});
if (!sameAddress(recoveredSigner, receipt.agent.owner) || !sameAddress(recoveredSigner, attestation.signer)) {
  throw new Error("Attestation signer does not match the ERC-8004 owner");
}
if (!Object.values(receipt.verification.checks).every(Boolean)) throw new Error("Receipt contains a failed evidence check");

let anchorVerified = false;
if (anchor) {
  const expectedAnchorMessage = `${receipt.schema}|${receiptId}`;
  if (
    anchor.receiptId !== receiptId ||
    anchor.message !== expectedAnchorMessage ||
    anchor.data !== stringToHex(expectedAnchorMessage) ||
    anchor.network !== "eip155:5042002"
  ) throw new Error("Receipt anchor does not bind the current Receipt ID");
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http("https://rpc.testnet.arc.network") });
  const [transaction, transactionReceipt] = await Promise.all([
    publicClient.getTransaction({ hash: anchor.transactionHash }),
    publicClient.getTransactionReceipt({ hash: anchor.transactionHash }),
  ]);
  anchorVerified = transactionReceipt.status === "success" &&
    transaction.input === anchor.data &&
    transaction.value === 0n &&
    sameAddress(transaction.from, receipt.agent.owner) &&
    Boolean(transaction.to && sameAddress(transaction.to, receipt.agent.owner));
  if (!anchorVerified) throw new Error("Arc Testnet anchor verification failed");
}

process.stdout.write(`${JSON.stringify({
  verified: true,
  receiptId,
  signer: recoveredSigner,
  agentId: receipt.agent.id,
  jobId: receipt.jobSettlement.jobId,
  transferId: receipt.machinePayment.transferId,
  anchorVerified,
  anchorTransaction: anchor?.transactionHash,
}, null, 2)}\n`);
