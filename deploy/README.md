<!--
本文件说明 Arc Paylink 在现有 VPS 上的部署边界和维护方法。
维护时不得停止 OpenClaw，更新站点只替换静态目录并 reload Caddy。
-->

# 部署说明

- 服务器：`ubuntu@13.212.95.171`
- SSH 密钥：`~/.ssh/arc_vps_ed25519`
- 静态目录：`/var/www/arc-paylink`
- Web 服务：Caddy systemd service
- 现有 OpenClaw：监听 `127.0.0.1:8080/8082`，与本站隔离

更新流程：本机运行 `npm run build`，把 `dist/` 上传并覆盖静态目录。Caddy 配置没有变化时无需重启服务。

TCP 80/443 已对公网开放。Caddy 自动维护 `13-212-95-171.sslip.io` 的 TLS 证书，并把 IP 形式的 HTTP 请求跳转到 HTTPS 域名。

最初通过聊天提供的 RSA 密钥已经从服务器撤销并从本机删除，禁止重新使用。
