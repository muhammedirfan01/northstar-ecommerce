import { useState } from "react";
import { API } from "./data.js";
import { Modal } from "./shared.jsx";
export default function OrderActionDialog({ order, action, close, saved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reason, setReason] = useState(""),
    [received, setReceived] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (busy || (action === "paid" && !received)) return;
    setBusy(true);
    setError("");
    try {
      await API.post(
        `/admin/orders/${order.id}/${action === "paid" ? "mark-paid" : "cancel"}`,
        action === "paid" ? {} : { reason: reason.trim() },
      );
      saved();
    } catch (failure) {
      setError(
        failure.response?.data?.message || "The order could not be updated.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={action === "paid" ? "Mark as paid" : "Cancel order"}
      subtitle={order.orderId}
      close={() => {
        if (!busy) close();
      }}
    >
      <form className="ops-modal-body" onSubmit={submit}>
        {action === "paid" ? (
          <label className="business-check">
            <input
              type="checkbox"
              checked={received}
              disabled={busy}
              onChange={(event) => setReceived(event.target.checked)}
            />
            I confirm that payment has been received for this cash order.
          </label>
        ) : (
          <>
            <p>Cancel this order and restore its reserved stock.</p>
            <label>
              Cancellation reason (optional)
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={300}
                disabled={busy}
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="ops-error">
            {error}
          </p>
        )}
        <footer className="ops-modal-actions">
          <button
            type="button"
            className="cm-button"
            disabled={busy}
            onClick={close}
          >
            Keep order
          </button>
          <button
            className="catalog-primary"
            disabled={busy || (action === "paid" && !received)}
          >
            {busy
              ? "Saving…"
              : action === "paid"
                ? "Confirm payment received"
                : "Confirm cancellation"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
