/**
 * 本文件实现 Arc Testnet 收款链接的创建、分享和支付闭环。
 * 所有签名都留在用户钱包中，页面与部署服务器不接触私钥。
 */
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { formatEther, isAddress, type Address, type Hash } from "viem";
import {
  arcTestnet,
  compactAddress,
  connectWallet,
  sendPayment,
  waitForPayment,
} from "./arc";
import {
  fundEscrow,
  escrowContract,
  loadEscrows,
  isPaymentId,
  readEscrow,
  replaceEscrows,
  refundEscrow,
  releaseEscrow,
  saveEscrow,
  type EscrowRecord,
} from "./escrow";

type Status = "idle" | "connecting" | "signing" | "confirming" | "success" | "error";

const params = new URLSearchParams(window.location.search);
const initialRecipient = params.get("to") ?? import.meta.env.VITE_DEFAULT_RECIPIENT ?? "";
const initialAmount = params.get("amount") ?? "";
const initialNote = params.get("note") ?? "";
const initialMode = params.get("mode") === "protected" ? "protected" : "direct";
const escrowParam = params.get("escrow");
const initialEscrowId = isPaymentId(escrowParam) ? escrowParam : undefined;
const initialEscrows = loadEscrows();
const proofPaymentId = "0x51a8242e1a04a1557b18a85d3e2da62d9b2eff92e1657b389ab331392b5c5c6f";

function friendlyError(error: unknown, language: "zh" | "en") {
  const candidate = error as { code?: number; shortMessage?: string; message?: string };
  if (candidate.code === 4001) return language === "zh" ? "你取消了钱包请求，没有发生交易。" : "You rejected the wallet request. No transaction was sent.";
  return candidate.shortMessage || candidate.message || (language === "zh" ? "操作失败，请稍后重试。" : "The operation failed. Please try again.");
}

export default function App() {
  const [language, setLanguage] = useState<"zh" | "en">(() => navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");
  const [recipient, setRecipient] = useState(initialRecipient);
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState(initialNote);
  const [paymentMode, setPaymentMode] = useState<"direct" | "protected">(initialMode);
  const [account, setAccount] = useState<Address>();
  const [balance, setBalance] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState<Hash>();
  const [escrow, setEscrow] = useState<EscrowRecord | undefined>(initialEscrows[0]);
  const [escrows, setEscrows] = useState<EscrowRecord[]>(initialEscrows);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [copied, setCopied] = useState(false);
  const [escrowLinkCopied, setEscrowLinkCopied] = useState(false);
  const [qrCode, setQrCode] = useState({ url: "", data: "" });
  const tr = (zh: string, en: string) => language === "zh" ? zh : en;

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    const stored = loadEscrows();
    const recordsToLoad = initialEscrowId && !stored.some((record) => record.paymentId === initialEscrowId)
      ? [{ paymentId: initialEscrowId }]
      : stored;
    Promise.all(recordsToLoad.map(async (record) => {
      try {
        return await readEscrow(record.paymentId) ?? record;
      } catch {
        return record;
      }
    })).then((loaded) => {
      const current = loaded.filter((record): record is EscrowRecord => "payer" in record);
      const merged = [...current, ...stored.filter((record) => !current.some((item) => item.paymentId === record.paymentId))].slice(0, 10);
      setEscrows(merged);
      if (current[0]) {
        setEscrow(current[0]);
        if (initialEscrowId) {
          setRecipient(current[0].payee);
          setAmount(formatEther(BigInt(current[0].amount)));
          setPaymentMode("protected");
        }
      }
      replaceEscrows(merged);
    });
    return () => window.clearInterval(timer);
  }, []);

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
      setMessage(friendlyError(error, language));
    }
  }

  async function handleCopy() {
    if (!requestUrl) return;
    await copyText(requestUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function handleEscrowLinkCopy() {
    if (!escrow) return;
    const url = new URL(window.location.origin);
    url.searchParams.set("escrow", escrow.paymentId);
    await copyText(url.toString());
    setEscrowLinkCopied(true);
    window.setTimeout(() => setEscrowLinkCopied(false), 1800);
  }

  async function copyText(value: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  async function handlePay() {
    if (!validRecipient || !validAmount) return;
    setStatus("signing");
    setMessage(tr("请在钱包中确认这笔测试网交易。", "Confirm this testnet transaction in your wallet."));
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
      if (protectedPayment) {
        const record: EscrowRecord = {
          paymentId: protectedPayment.paymentId,
          payer: protectedPayment.payer,
          payee: recipient as Address,
          amount: parseAmountToWei(amount),
          refundAfter: protectedPayment.refundAfter,
          status: "funded",
        };
        setEscrow(record);
        setEscrows((current) => [record, ...current.filter((item) => item.paymentId !== record.paymentId)].slice(0, 10));
        saveEscrow(record);
      }
      setHash(txHash);
      setStatus("confirming");
      setMessage(tr("交易已发送，正在等待 Arc Testnet 确认。", "Transaction sent. Waiting for Arc Testnet confirmation."));
      const receipt = await waitForPayment(txHash);
      if (receipt.status !== "success") throw new Error("交易执行失败。");
      setStatus("success");
      setMessage(paymentMode === "protected" ? tr("资金已进入托管，确认交付后再释放给收款方。", "Funds are in escrow. Release them after delivery.") : tr("支付成功，链上记录已经确认。", "Payment confirmed onchain."));
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error, language));
    }
  }

  async function handleRelease() {
    if (!escrow) return;
    setStatus("signing");
    setMessage(tr("请在钱包中确认释放托管资金。", "Confirm the escrow release in your wallet."));
    try {
      const txHash = await releaseEscrow(escrow.paymentId);
      setHash(txHash);
      setStatus("confirming");
      setMessage(tr("释放交易已发送，正在等待 Arc Testnet 确认。", "Release sent. Waiting for Arc Testnet confirmation."));
      const receipt = await waitForPayment(txHash);
      if (receipt.status !== "success") throw new Error("释放交易执行失败。");
      setStatus("success");
      setMessage(tr("托管资金已经释放给收款方。", "Escrow funds were released to the recipient."));
      const updated = { ...escrow, status: "released" as const };
      setEscrow(updated);
      setEscrows((current) => current.map((item) => item.paymentId === updated.paymentId ? updated : item));
      saveEscrow(updated);
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error, language));
    }
  }

  async function handleRefund() {
    if (!escrow) return;
    setStatus("signing");
    setMessage(tr("请在钱包中确认到期退款交易。", "Confirm the expired escrow refund in your wallet."));
    try {
      const txHash = await refundEscrow(escrow.paymentId);
      setHash(txHash);
      setStatus("confirming");
      setMessage(tr("退款交易已发送，正在等待 Arc Testnet 确认。", "Refund sent. Waiting for Arc Testnet confirmation."));
      const receipt = await waitForPayment(txHash);
      if (receipt.status !== "success") throw new Error("退款交易执行失败。");
      const updated = { ...escrow, status: "refunded" as const };
      setEscrow(updated);
      setEscrows((current) => current.map((item) => item.paymentId === updated.paymentId ? updated : item));
      saveEscrow(updated);
      setStatus("success");
      setMessage(tr("托管资金已经原路退回付款钱包。", "Escrow funds were returned to the payer."));
    } catch (error) {
      setStatus("error");
      setMessage(friendlyError(error, language));
    }
  }

  function parseAmountToWei(value: string) {
    const [whole, fraction = ""] = value.split(".");
    return `${whole}${fraction.padEnd(18, "0").slice(0, 18)}`.replace(/^0+(?=\d)/, "");
  }

  const refundRemaining = escrow?.status === "funded" ? Math.max(0, escrow.refundAfter - now) : 0;
  const refundCountdown = `${String(Math.floor(refundRemaining / 3600)).padStart(2, "0")}:${String(Math.floor(refundRemaining % 3600 / 60)).padStart(2, "0")}:${String(refundRemaining % 60).padStart(2, "0")}`;

  const isBusy = ["connecting", "signing", "confirming"].includes(status);

  return (
    <main>
      <nav>
        <a className="brand" href="/" aria-label="Arc Paylink 首页">
          <span className="brand-mark">A</span>
          <span>Arc Paylink</span>
        </a>
        <div className="nav-actions">
          <a className="proof-link" href={`/?escrow=${proofPaymentId}`}>{tr("链上演示", "Live proof")}</a>
          <button className="language-button" onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>{language === "zh" ? "EN" : "中文"}</button>
          <span className="network"><i /> Arc Testnet</span>
          <button className="wallet-button" onClick={handleConnect} disabled={isBusy}>
            {account ? compactAddress(account) : status === "connecting" ? tr("连接中…", "Connecting…") : tr("连接钱包", "Connect wallet")}
          </button>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">STABLECOIN PAYMENT LINKS</p>
        <h1>{tr("一句话收款，", "Payment requests,")}<br /><em>{tr("一秒钟确认。", "programmed onchain.")}</em></h1>
        <p className="intro">{tr("无需后端保存私钥。创建一个 Arc Testnet USDC 收款链接，让付款人在自己的钱包中完成签名。", "Create a native USDC invoice with direct settlement or delivery-protected escrow. Every transaction stays in the payer’s wallet.")}</p>
        <div className="proof-row">
          <span>{tr("USDC 原生 Gas", "USDC native gas")}</span><span>{tr("钱包内签名", "Wallet signed")}</span><span>{tr("ArcScan 可验证", "ArcScan verified")}</span>
        </div>
      </section>

      {initialEscrowId && <section className="proof-banner">
        <strong>{tr("真实链上演示订单", "Live onchain proof")}</strong>
        <span>{tr("此页面直接读取 Arc Testnet 合约，不依赖服务器数据库。", "This page reads Arc Testnet contract state directly—no server database required.")}</span>
        <a href={`${arcTestnet.blockExplorers.default.url}/tx/0x05f37466ad220a1639cc82f427c9b4b5cc43041dc6751ea6fc1976be8b8c97c7`} target="_blank" rel="noreferrer">{tr("查看放款交易 ↗", "View release transaction ↗")}</a>
      </section>}

      <section className="workspace">
        <div className="form-panel">
          <div className="section-heading">
            <span className="step-number">01</span>
            <div><h2>{tr("创建收款请求", "Create an invoice")}</h2><p>{tr("填入收款地址、金额和备注。", "Set the recipient, amount and settlement rules.")}</p></div>
          </div>

          <label>{tr("收款地址", "Recipient")}</label>
          <div className={`field ${recipient && !validRecipient ? "invalid" : ""}`}>
            <input value={recipient} onChange={(event) => setRecipient(event.target.value.trim())} placeholder="0x…" spellCheck={false} />
            {account && <button onClick={() => setRecipient(account)}>{tr("使用我的", "Use mine")}</button>}
          </div>

          <label>{tr("金额", "Amount")}</label>
          <div className={`field amount-field ${amount && !validAmount ? "invalid" : ""}`}>
            <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25.00" />
            <span>USDC</span>
          </div>

          <label>{tr("付款方式", "Settlement mode")}</label>
          <div className="mode-switch" role="group" aria-label="付款方式">
            <button className={paymentMode === "direct" ? "active" : ""} onClick={() => setPaymentMode("direct")}>{tr("直接支付", "Direct")}<small>{tr("即时到账", "Settle immediately")}</small></button>
            <button className={paymentMode === "protected" ? "active" : ""} onClick={() => setPaymentMode("protected")}>{tr("受保护支付", "Protected")}<small>{tr("确认交付后释放", "Release after delivery")}</small></button>
          </div>

          <label>{tr("备注", "Note")} <small>{tr("选填", "Optional")}</small></label>
          <div className="field">
            <input maxLength={80} value={note} onChange={(event) => setNote(event.target.value)} placeholder="设计服务 / 订单 #1042" />
          </div>

          {account && <p className="balance">{tr("当前钱包余额", "Wallet balance")}: {balance} USDC</p>}
          <div className="actions">
            <button className="primary" onClick={handlePay} disabled={!validRecipient || !validAmount || isBusy}>
              {status === "signing" ? tr("等待钱包确认…", "Confirm in wallet…") : status === "confirming" ? tr("链上确认中…", "Confirming onchain…") : paymentMode === "protected" ? tr("存入 USDC 托管", "Fund USDC escrow") : tr("支付这笔请求", "Pay this invoice")}
            </button>
            <button className="secondary" onClick={handleCopy} disabled={!requestUrl}>{copied ? tr("已复制", "Copied") : tr("复制收款链接", "Copy invoice link")}</button>
          </div>
          {escrow && <div className="escrow-card">
            <div><span>{tr("最近托管订单", "Selected escrow")}</span><strong>{escrow.status === "funded" ? tr("托管中", "Funded") : escrow.status === "released" ? tr("已放款", "Released") : tr("已退款", "Refunded")}</strong></div>
            <div><span>{tr("金额", "Amount")}</span><strong>{formatEther(BigInt(escrow.amount))} USDC</strong></div>
            <div><span>{tr("付款方", "Payer")}</span><strong>{compactAddress(escrow.payer)}</strong></div>
            <div><span>{tr("收款方", "Payee")}</span><strong>{compactAddress(escrow.payee)}</strong></div>
            <div><span>{tr("退款时间", "Refund window")}</span><strong>{escrow.status === "funded" ? refundRemaining > 0 ? refundCountdown : tr("现在可退款", "Refund available") : "—"}</strong></div>
            <div className="escrow-links">
              <a href={`${arcTestnet.blockExplorers.default.url}/address/${escrowContract}`} target="_blank" rel="noreferrer">{tr("查看托管合约 ↗", "View contract ↗")}</a>
              <button onClick={handleEscrowLinkCopy}>{escrowLinkCopied ? tr("状态链接已复制", "Status link copied") : tr("复制状态链接", "Copy status link")}</button>
            </div>
            {escrow.status === "funded" && refundRemaining > 0 && <button className="release-button" onClick={handleRelease} disabled={isBusy}>{tr("确认交付并释放资金", "Confirm delivery and release")}</button>}
            {escrow.status === "funded" && refundRemaining === 0 && <button className="refund-button" onClick={handleRefund} disabled={isBusy}>{tr("取回到期托管资金", "Refund expired escrow")}</button>}
          </div>}

          {escrows.length > 0 && <div className="escrow-history">
            <div className="history-heading"><strong>{tr("托管订单历史", "Escrow history")}</strong><span>{tr("链上状态", "Onchain status")}</span></div>
            {escrows.slice(0, 5).map((item) => <button key={item.paymentId} className={item.paymentId === escrow?.paymentId ? "active" : ""} onClick={() => setEscrow(item)}>
              <span><strong>{formatEther(BigInt(item.amount))} USDC</strong><small>{item.paymentId.slice(0, 10)}…{item.paymentId.slice(-6)}</small></span>
              <em>{item.status === "funded" ? tr("托管中", "Funded") : item.status === "released" ? tr("已放款", "Released") : tr("已退款", "Refunded")}</em>
            </button>)}
          </div>}

          {message && <div className={`status ${status}`} role="status">
            <span>{status === "success" ? "✓" : status === "error" ? "!" : "↗"}</span>
            <div><strong>{message}</strong>{hash && <a href={`${arcTestnet.blockExplorers.default.url}/tx/${hash}`} target="_blank" rel="noreferrer">{tr("在 ArcScan 查看交易 ↗", "View transaction on ArcScan ↗")}</a>}</div>
          </div>}
        </div>

        <aside className="preview-panel">
          <div className="section-heading">
            <span className="step-number">02</span>
            <div><h2>{tr("分享付款页面", "Share the invoice")}</h2><p>{tr("链接中的信息公开透明。", "Payment context travels with the link.")}</p></div>
          </div>
          <div className="receipt-card">
            <div className="receipt-top"><span>PAYMENT REQUEST</span><span className="live-dot">LIVE</span></div>
            <div className="receipt-amount"><span>{validAmount ? amount : "0.00"}</span><small>USDC</small></div>
            <div className="receipt-line"><span>{tr("收款方", "Recipient")}</span><strong>{validRecipient ? compactAddress(recipient) : tr("等待地址", "Add address")}</strong></div>
            <div className="receipt-line"><span>{tr("网络", "Network")}</span><strong>Arc Testnet</strong></div>
            <div className="receipt-line"><span>{tr("结算", "Settlement")}</span><strong>{paymentMode === "protected" ? tr("24h 托管保护", "24h escrow protection") : tr("即时到账", "Immediate")}</strong></div>
            <div className="receipt-line"><span>{tr("备注", "Note")}</span><strong>{note || "—"}</strong></div>
            <div className="qr-wrap">{qrCode.url === requestUrl ? <img src={qrCode.data} alt={tr("收款链接二维码", "Invoice QR code")} /> : <div className="qr-placeholder">{tr("填写有效信息", "Enter valid details")}<br />{tr("生成二维码", "to create a QR code")}</div>}</div>
          </div>
          <p className="disclaimer">{tr("仅限测试网。测试 USDC 没有现实货币价值。", "Testnet only. Test USDC has no real-world value.")}</p>
        </aside>
      </section>

      <footer><span>Built on Arc Testnet</span><a href="https://docs.arc.network" target="_blank" rel="noreferrer">{tr("开发文档 ↗", "Developer docs ↗")}</a><a href="https://faucet.circle.com" target="_blank" rel="noreferrer">{tr("领取测试 USDC ↗", "Get test USDC ↗")}</a></footer>
    </main>
  );
}
