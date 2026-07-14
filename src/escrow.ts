/**
 * 本文件封装 Arc Paylink 托管合约调用，让页面只处理业务状态与用户反馈。
 * 合约地址来自公开构建配置；所有写操作仍由浏览器钱包确认和签名。
 */
import {
  createWalletClient,
  custom,
  encodePacked,
  keccak256,
  parseEther,
  type Abi,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import artifact from "./generated/escrow.json";
import { arcTestnet, publicClient } from "./arc";

export const escrowContract = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS as Address;
const escrowAbi = artifact.abi as Abi;
const storageKey = "arc-paylink:escrows";

export type EscrowStatus = "funded" | "released" | "refunded";

export type EscrowRecord = {
  paymentId: Hex;
  payer: Address;
  payee: Address;
  amount: string;
  refundAfter: number;
  status: EscrowStatus;
};

function walletClient() {
  if (!window.ethereum) throw new Error("钱包未连接。");
  return createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
}

export async function fundEscrow(
  payee: Address,
  amount: string,
  note: string,
) {
  const client = walletClient();
  const [account] = await client.requestAddresses();
  const paymentId = keccak256(
    encodePacked(
      ["address", "address", "uint256", "string", "uint256"],
      [account, payee, parseEther(amount), note, BigInt(Date.now())],
    ),
  );
  const latestBlock = await publicClient.getBlock();
  const refundAfter = Number(latestBlock.timestamp) + 24 * 60 * 60;
  const hash = await client.writeContract({
    account,
    chain: arcTestnet,
    address: escrowContract,
    abi: escrowAbi,
    functionName: "fund",
    args: [paymentId, payee, refundAfter],
    value: parseEther(amount),
  });
  return { hash, paymentId, refundAfter, payer: account };
}

export async function releaseEscrow(paymentId: Hex): Promise<Hash> {
  const client = walletClient();
  const [account] = await client.requestAddresses();
  return client.writeContract({
    account,
    chain: arcTestnet,
    address: escrowContract,
    abi: escrowAbi,
    functionName: "release",
    args: [paymentId],
  });
}

export async function refundEscrow(paymentId: Hex): Promise<Hash> {
  const client = walletClient();
  const [account] = await client.requestAddresses();
  return client.writeContract({
    account,
    chain: arcTestnet,
    address: escrowContract,
    abi: escrowAbi,
    functionName: "refund",
    args: [paymentId],
  });
}

export async function readEscrow(paymentId: Hex): Promise<EscrowRecord | undefined> {
  const result = await publicClient.readContract({
    address: escrowContract,
    abi: escrowAbi,
    functionName: "payments",
    args: [paymentId],
  }) as readonly [Address, Address, bigint, bigint, number];
  const [payer, payee, amount, refundAfter, rawStatus] = result;
  if (rawStatus === 0) return undefined;
  const statuses: Record<number, EscrowStatus> = { 1: "funded", 2: "released", 3: "refunded" };
  return {
    paymentId,
    payer,
    payee,
    amount: amount.toString(),
    refundAfter: Number(refundAfter),
    status: statuses[rawStatus],
  };
}

export function loadEscrows(): EscrowRecord[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as EscrowRecord[];
  } catch {
    return [];
  }
}

export function saveEscrow(record: EscrowRecord) {
  const records = loadEscrows().filter((item) => item.paymentId !== record.paymentId);
  localStorage.setItem(storageKey, JSON.stringify([record, ...records].slice(0, 10)));
}
