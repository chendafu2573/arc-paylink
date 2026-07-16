/**
 * 本文件用于把分散的 Agent 身份、策略执行、任务结算和 x402 支付证据汇总成单一可验证 Receipt。
 * 核心逻辑是交叉校验关键主体与任务字段，再用稳定 JSON 计算 SHA-256 标识；维护时新增证据必须同时补充一致性检查。
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

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

const [identity, execution, job, gateway] = await Promise.all([
  readJson("src/generated/agent-identity.json"),
  readJson("public/agent-runs/latest-execution.json"),
  readJson("public/erc8183-job.json"),
  readJson("public/gateway-proof.json"),
]);

const checks = {
  identityMatchesExecution: identity.agentId === execution.agentId && sameAddress(identity.owner, execution.agentAddress),
  executionMatchesJob: execution.agentId === job.agentId && sameAddress(execution.agentAddress, job.client),
  policyPaymentExecuted: execution.decision === "executed" && Boolean(execution.transactionHash),
  jobCompleted: job.status === "Completed" && Boolean(job.transactions.complete),
  gatewayMatchesJob: gateway.agentId === job.agentId && gateway.response.jobId === job.jobId,
  gatewayBuyerMatchesClient: sameAddress(gateway.buyer, job.client) && sameAddress(gateway.response.paidBy, job.client),
  gatewayDeliverableMatchesJob: gateway.response.deliverableHash === job.deliverableHash,
  gatewayPaymentReceived: gateway.protocol === "x402" && gateway.httpStatus === 200 && gateway.transferStatus === "received",
};

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
if (failedChecks.length) throw new Error(`Agent receipt evidence mismatch: ${failedChecks.join(", ")}`);

const evidence = {
  identity: { path: "/agent-identity.json", digest: digest(identity) },
  policyExecution: { path: "/agent-runs/latest-execution.json", digest: digest(execution) },
  jobSettlement: { path: "/erc8183-job.json", digest: digest(job) },
  machinePayment: { path: "/gateway-proof.json", digest: digest(gateway) },
};

const receiptCore = {
  schema: "arc-paylink-agent-receipt/v1",
  network: { name: "Arc Testnet", chainId: 5042002, caip2: "eip155:5042002" },
  agent: {
    standard: "ERC-8004",
    id: identity.agentId,
    owner: identity.owner,
    registry: identity.registry,
    registrationTransaction: identity.registerHash,
  },
  policyExecution: {
    vault: execution.vault,
    paymentId: execution.paymentId,
    amount: execution.amount,
    transaction: execution.transactionHash,
    blockNumber: execution.blockNumber,
    checks: execution.checks,
  },
  jobSettlement: {
    standard: job.standard,
    contract: job.contract,
    jobId: job.jobId,
    client: job.client,
    provider: job.provider,
    evaluator: job.evaluator,
    budget: job.budget,
    status: job.status,
    deliverableHash: job.deliverableHash,
    completionTransaction: job.transactions.complete,
  },
  machinePayment: {
    product: gateway.product,
    protocol: gateway.protocol,
    payer: gateway.buyer,
    payee: gateway.seller,
    amount: `${gateway.amount} USDC`,
    resource: gateway.resource,
    transferId: gateway.transferId,
    transferStatus: gateway.transferStatus,
    httpStatus: gateway.httpStatus,
    verifiedSignal: gateway.response.signal,
  },
  evidence,
  verification: { status: "verified", checks },
};

const receipt = {
  ...receiptCore,
  receiptId: digest(receiptCore),
  issuedAt: gateway.verifiedAt,
};

const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
const outputs = ["src/generated/agent-receipt.json", "public/agent-receipt.json"];
const identityOutput = "public/agent-identity.json";
const identitySerialized = `${JSON.stringify(identity, null, 2)}\n`;

if (process.argv.includes("--check")) {
  for (const output of outputs) {
    const current = await readFile(path.join(root, output), "utf8");
    if (current !== serialized) throw new Error(`Agent receipt is stale: ${output}`);
  }
  if (await readFile(path.join(root, identityOutput), "utf8") !== identitySerialized) {
    throw new Error(`Agent identity evidence is stale: ${identityOutput}`);
  }
  process.stdout.write(`Verified ${receipt.receiptId}\n`);
} else {
  await Promise.all(outputs.map((output) => writeFile(path.join(root, output), serialized)));
  await writeFile(path.join(root, identityOutput), identitySerialized);
  process.stdout.write(`Generated ${receipt.receiptId}\n`);
}
