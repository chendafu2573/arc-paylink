/**
 * 本文件是应用启动入口，负责挂载页面与全局样式。
 * 保持入口无业务状态，避免部署环境差异影响钱包流程。
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
