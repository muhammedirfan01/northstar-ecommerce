import { canCancelRequest } from "./requestEligibility.js";
import { useState } from "react";
import API from "../../api/API.js";

export default function CancelReturnButton({ order, onUpdate }) {
  const noun = order.returnRequest?.resolution === "replacement" ? "replacement" : "return";
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!canCancelRequest(order)) return null;
  const reserved = order.returnRequest?.replacementStatus === "ready_to_ship";
  async function cancel() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await API.post(`/orders/${order.id}/return/cancel`, { requestCycle: order.returnRequest?.cycle || 1 });
      onUpdate(data.data.order);
      setConfirming(false);
    } catch (e) {
      setError(e.response?.data?.message || "The request could not be cancelled. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="purchase-stack">
      {error && <p className="purchase-alert" role="alert">{error}</p>}
      {confirming ? (
        <div role="group" aria-label="Confirm return cancellation">
          <p>{reserved ? "Cancel this replacement before dispatch? The replacement stock will be released and your paid amount will be refunded to your wallet." : `Cancel this ${noun} request? Your delivered order will stay unchanged.`}</p>
          <button type="button" className="purchase-button" disabled={busy} onClick={() => setConfirming(false)}>Keep request</button>{" "}
          <button type="button" className="purchase-button" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Confirm cancellation"}</button>
        </div>
      ) : <button type="button" className="purchase-button" onClick={() => setConfirming(true)}>Cancel {noun} request</button>}
    </div>
  );
}
