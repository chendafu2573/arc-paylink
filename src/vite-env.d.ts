/**
 * 本文件补充 Vite 与注入式 EVM 钱包的浏览器类型。
 * 钱包接口保持最小集合，新增调用时同步收紧参数与返回类型。
 */
/// <reference types="vite/client" />

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
}

interface Window {
  ethereum?: EthereumProvider;
}
