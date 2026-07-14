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
  return { hash, paymentId, refundAfter };
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
