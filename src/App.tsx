/**
 * 本文件实现 Arc Testnet 收款链接的创建、分享和支付闭环。
 * 所有签名都留在用户钱包中，页面与部署服务器不接触私钥。
 */
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { isAddress, type Address, type Hash, type Hex } from "viem";
import {
  arcTestnet,
  compactAddress,
  connectWallet,
  sendPayment,
  waitForPayment,
} from "./arc";
import { fundEscrow, releaseEscrow } from "./escrow";

type Status = "idle" | "connecting" | "signing" | "confirming" | "success" | "error";

const params = new URLSearchParams(window.location.search);
const initialRecipient = params.get("to") ?? import.meta.env.VITE_DEFAULT_RECIPIENT ?? "";
const initialAmount = params.get("amount") ?? "";
const initialNote = params.get("note") ?? "";
const initialMode = params.get("mode") === "protected" ? "protected" : "direct";

function friendlyError(error: unknown) {
  const candidate = error as { code?: number; shortMessage?: string; message?: string };
  if (candidate.code === 4001) return "你取消了钱包请求，没有发生交易。";
  return candidate.shortMessage || candidate.message || "操作失败，请稍后重试。";
}

export default function App() {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState(initialNote);
  const [paymentMode, setPaymentMode] = useState<"direct" | "protected">(initialMode);
  const [account, setAccount] = useState<Address>();
  const [balance, setBalance] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [escrowId, setEscrowId] = useState<Hex>();
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState({ url: "", data: "" });

  const validRecipient = isAddress(recipient);
  const validAmount = Number(amount) > 0 && Number.isFinite(Number(amount));
  const requestUrl = useMemo(() => {
    if (!validRecipient || !validAmount) return "";
    const url = new URL(window.location.origin);
    url.searchParams.set("to", recipient);
    url.searchParams.set("amount", amount);
    if (note.trim()) url.searchParams.set("note", note.trim());
    if (paymentMode === "protected") url.searchParams.set("mode", "protected");
    return url.toString();
  }, [amount, note, paymentMode, recipient, validAmount, validRecipient]);

  useEffect(() => {
    if (!requestUrl) return;
    QRCode.toDataURL(requestUrl, {
      width: 256,
      margin: 1,
      color: { dark: "#07110d", light: "#f4f1e8" },
    }).then((data) => setQrCode({ url: requestUrl, data }));
  }, [requestUrl]);

  async function handleConnect() {
    setStatus("connecting");
    setMessage("");
    try {
      const connected = await connectWallet();
      setAccount(connected.account);
      setBalance(Number(connected.balance).toFixed(4));
      setStatus("idle");
      if (!recipient) setRecipient(connected.account);
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error));
    }
  }

  async function handleCopy() {
    if (!requestUrl) return;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(requestUrl);
    } else {
      const input = document.createElement("textarea");
      input.value = requestUrl;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handlePay() {
    if (!validRecipient || !validAmount) return;
    setStatus("signing");
    setMessage("请在钱包中确认这笔测试网交易。");
    setHash(undefined);
    try {
      if (!account) {
        const connected = await connectWallet();
        setAccount(connected.account);
        setBalance(Number(connected.balance).toFixed(4));
      }
      const protectedPayment = paymentMode === "protected"
        ? await fundEscrow(recipient as Address, amount, note.trim())
        : undefined;
      const txHash = protectedPayment?.hash ?? await sendPayment(recipient as Address, amount);
      setEscrowId(protectedPayment?.paymentId);
      setHash(txHash);
      setStatus("confirming");
      setMessage("交易已发送，正在等待 Arc Testnet 确认。");
      const receipt = await waitForPayment(txHash);
      if (receipt.status !== "success") throw new Error("交易执行失败。");
      setStatus("success");
      setMessage(paymentMode === "protected" ? "资金已进入托管，确认交付后再释放给收款方。" : "支付成功，链上记录已经确认。");
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error));
    }
  }

  async function handleRelease() {
    if (!escrowId) return;
    setStatus("signing");
    setMessage("请在钱包中确认释放托管资金。");
    try {
      const txHash = await releaseEscrow(escrowId);
      setHash(txHash);
      setStatus("confirming");
      setMessage("释放交易已发送，正在等待 Arc Testnet 确认。");
      const receipt = await waitForPayment(txHash);
      if (receipt.status !== "success") throw new Error("释放交易执行失败。");
      setStatus("success");
      setMessage("托管资金已经释放给收款方。");
      setEscrowId(undefined);
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error));
    }
  }

  const isBusy = ["connecting", "signing", "confirming"].includes(status);

  return (
    <main>
      <nav>
        <a className="brand" href="/" aria-label="Arc Paylink 首页">
          <span className="brand-mark">A</span>
          <span>Arc Paylink</span>
        </a>
        <div className="nav-actions">
          <span className="network"><i /> Arc Testnet</span>
          <button className="wallet-button" onClick={handleConnect} disabled={isBusy}>
            {account ? compactAddress(account) : status === "connecting" ? "连接中…" : "连接钱包"}
          </button>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">STABLECOIN PAYMENT LINKS</p>
        <h1>一句话收款，<br /><em>一秒钟确认。</em></h1>
        <p className="intro">无需后端保存私钥。创建一个 Arc Testnet USDC 收款链接，让付款人在自己的钱包中完成签名。</p>
        <div className="proof-row">
          <span>USDC 原生 Gas</span><span>钱包内签名</span><span>ArcScan 可验证</span>
        </div>
      </section>

      <section className="workspace">
        <div className="form-panel">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div><h2>创建收款请求</h2><p>填入收款地址、金额和备注。</p></div>
          </div>

          <label>收款地址</label>
          <div className={`field ${recipient && !validRecipient ? "invalid" : ""}`}>
            <input value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" spellCheck={false} />
            {account && <button onClick={() => setRecipient(account)}>使用我的</button>}
          </div>

          <label>金额</label>
          <div className={`field amount-field ${amount && !validAmount ? "invalid" : ""}`}>
            <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25.00" />
            <span>USDC</span>
          </div>

          <label>付款方式</label>
          <div className="mode-switch" role="group" aria-label="付款方式">
            <button className={paymentMode === "direct" ? "active" : ""} onClick={() => setPaymentMode("direct")}>直接支付<small>即时到账</small></button>
            <button className={paymentMode === "protected" ? "active" : ""} onClick={() => setPaymentMode("protected")}>受保护支付<small>确认交付后释放</small></button>
          </div>

          <label>备注 <small>选填</small></label>
          <div className="field">
            <input maxLength={80} value={note} onChange={(event) => setNote(event.target.value)} placeholder="设计服务 / 订单 #1042" />
          </div>

          {account && <p className="balance">当前钱包余额：{balance} USDC</p>}
          <div className="actions">
            <button className="primary" onClick={handlePay} disabled={!validRecipient || !validAmount || isBusy}>
              {status === "signing" ? "等待钱包确认…" : status === "confirming" ? "链上确认中…" : paymentMode === "protected" ? "存入 USDC 托管" : "支付这笔请求"}
            </button>
            <button className="secondary" onClick={handleCopy} disabled={!requestUrl}>{copied ? "已复制" : "复制收款链接"}</button>
          </div>
          {escrowId && status === "success" && <button className="release-button" onClick={handleRelease}>确认交付并释放资金</button>}

          {message && <div className={`status ${status}`} role="status">
            <span>{status === "success" ? "✓" : status === "error" ? "!" : "↗"}</span>
            <div><strong>{message}</strong>{hash && <a href={`${arcTestnet.blockExplorers.default.url}/tx/${hash}`} target="_blank" rel="noreferrer">在 ArcScan 查看交易 ↗</a>}</div>
          </div>}
        </div>

        <aside className="preview-panel">
          <div className="section-heading">
            <span className="step-number">02</span>
            <div><h2>分享付款页面</h2><p>链接中的信息公开透明。</p></div>
          </div>
          <div className="receipt-card">
            <div className="receipt-top"><span>PAYMENT REQUEST</span><span className="live-dot">LIVE</span></div>
            <div className="receipt-amount"><span>{validAmount ? amount : "0.00"}</span><small>USDC</small></div>
            <div className="receipt-line"><span>收款方</span><strong>{validRecipient ? compactAddress(recipient) : "等待地址"}</strong></div>
            <div className="receipt-line"><span>网络</span><strong>Arc Testnet</strong></div>
            <div className="receipt-line"><span>结算</span><strong>{paymentMode === "protected" ? "24h 托管保护" : "即时到账"}</strong></div>
            <div className="receipt-line"><span>备注</span><strong>{note || "—"}</strong></div>
            <div className="qr-wrap">{qrCode.url === requestUrl ? <img src={qrCode.data} alt="收款链接二维码" /> : <div className="qr-placeholder">填写有效信息<br />生成二维码</div>}</div>
          </div>
          <p className="disclaimer">仅限测试网。测试 USDC 没有现实货币价值。</p>
        </aside>
      </section>

      <footer><span>Built on Arc Testnet</span><a href="https://docs.arc.network" target="_blank" rel="noreferrer">开发文档 ↗</a><a href="https://faucet.circle.com" target="_blank" rel="noreferrer">领取测试 USDC ↗</a></footer>
    </main>
  );
}
