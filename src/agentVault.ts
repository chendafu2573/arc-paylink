/**
 * 本文件封装 Agent Vault 的创建、受限支付和公开策略读取，供页面展示可验证的 Agent 权限边界。
 * 写操作始终由浏览器钱包签名；前端只组装策略参数，不保存任何密钥。
 */
import { createWalletClient, custom, encodePacked, formatEther, keccak256, parseEther, type Abi, type Address, type Hash } from "viem";
import artifact from "./generated/agent-vault.json";
import { arcTestnet, publicClient } from "./arc";

const agentVaultAbi = artifact.abi as Abi;
export const demoAgentVault = import.meta.env.VITE_AGENT_VAULT_ADDRESS as Address;

export type AgentVaultPolicy = {
  address: Address;
  owner: Address;
  agent: Address;
  totalBudget: string;
  maxPerPayment: string;
  spent: string;
  validUntil: number;
  revoked: boolean;
};

function walletClient() {
  if (!window.ethereum) throw new Error("钱包未连接。");
  return createWalletClient({ chain: arcTestnet, transport: custom(window.ethereum) });
}

export async function deployAgentVault(agent: Address, recipient: Address, budget: string, paymentLimit: string) {
  const client = walletClient();
  const [account] = await client.requestAddresses();
  const latestBlock = await publicClient.getBlock();
  const validUntil = Number(latestBlock.timestamp) + 7 * 24 * 60 * 60;
  const budgetWei = parseEther(budget);
  const hash = await client.deployContract({
    account,
    chain: arcTestnet,
    abi: agentVaultAbi,
    bytecode: artifact.bytecode as `0x${string}`,
    args: [agent, budgetWei, parseEther(paymentLimit), validUntil, [recipient]],
    value: budgetWei,
  });
  return { hash, validUntil };
}

export async function executeAgentPayment(vault: Address, recipient: Address, amount: string): Promise<Hash> {
  const client = walletClient();
  const [account] = await client.requestAddresses();
  const paymentId = keccak256(encodePacked(
    ["address", "address", "uint256", "uint256"],
    [account, recipient, parseEther(amount), BigInt(Date.now())],
  ));
  return client.writeContract({
    account,
    chain: arcTestnet,
    address: vault,
    abi: agentVaultAbi,
    functionName: "pay",
    args: [paymentId, recipient, parseEther(amount)],
  });
}

export async function readAgentVault(address: Address): Promise<AgentVaultPolicy> {
  const [owner, agent, totalBudget, maxPerPayment, spent, validUntil, revoked] = await Promise.all([
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "owner" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "agent" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "totalBudget" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "maxPerPayment" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "spent" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "validUntil" }),
    publicClient.readContract({ address, abi: agentVaultAbi, functionName: "revoked" }),
  ]);
  return {
    address,
    owner: owner as Address,
    agent: agent as Address,
    totalBudget: formatEther(totalBudget as bigint),
    maxPerPayment: formatEther(maxPerPayment as bigint),
    spent: formatEther(spent as bigint),
    validUntil: Number(validUntil),
    revoked: revoked as boolean,
  };
}
