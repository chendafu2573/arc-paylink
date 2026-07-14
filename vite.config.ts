/**
 * 本文件为 Arc Paylink 提供可复现的 Vite 构建配置。
 * 应用以纯静态产物部署，维护时避免引入服务器端密钥依赖。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
