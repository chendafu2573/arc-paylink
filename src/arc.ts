/**
 * 本文件集中维护 Arc Testnet 参数和钱包操作，避免页面散落链配置。
 * 网络参数变更时以 Arc 官方文档为准，只需在此处统一更新。
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatEther,
  http,
  parseEther,
  type Address,
  type Hash,
} from "viem";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(),
});

export function compactAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("未检测到浏览器钱包，请安装 MetaMask 或 Rabby。");
  }

  const chainId = `0x${arcTestnet.id.toString(16)}`;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: arcTestnet.name,
          nativeCurrency: arcTestnet.nativeCurrency,
          rpcUrls: arcTestnet.rpcUrls.default.http,
          blockExplorerUrls: [arcTestnet.blockExplorers.default.url],
        },
      ],
    });
  }

  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
  const [account] = await walletClient.requestAddresses();
  const balance = await publicClient.getBalance({ address: account });
  return { account, balance: formatEther(balance), walletClient };
}

export async function sendPayment(recipient: Address, amount: string) {
  if (!window.ethereum) throw new Error("钱包未连接。");
  const walletClient = createWalletClient({
    chain: arcTestnet,
    transport: custom(window.ethereum),
  });
  const [account] = await walletClient.requestAddresses();
  const hash = await walletClient.sendTransaction({
    account,
    chain: arcTestnet,
    to: recipient,
    value: parseEther(amount),
  });
  return hash;
}

export async function waitForPayment(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash });
}
