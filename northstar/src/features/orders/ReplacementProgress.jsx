import { titleCase } from "./purchaseData.js";

export default function ReplacementProgress({ order, busy, onAdvance }) {
  const request = order.returnRequest;
  if (request?.resolution !== "replacement") return null;
  const status = request.replacementStatus && request.replacementStatus !== "none" ? request.replacementStatus : request.status === "accepted" ? "awaiting_returned_goods" : request.status === "requested" ? "awaiting_review" : request.status;
  const next = { ready_to_ship: ["shipped", "Mark replacement shipped"], shipped: ["out_for_delivery", "Mark replacement out for delivery"], out_for_delivery: ["delivered", "Mark replacement delivered"] }[status];
  return <div className="purchase-stack"><p><strong>Replacement: {titleCase(status)}</strong></p><p>Same product and option · No additional payment</p>{["shipped", "out_for_delivery"].includes(status) && <p>This replacement has been dispatched. After delivery, you can request a return or another replacement.</p>}{onAdvance && next && <button type="button" className="purchase-button" disabled={busy} onClick={() => onAdvance(next[0])}>{next[1]}</button>}</div>;
}
