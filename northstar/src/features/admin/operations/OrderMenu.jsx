import { Link } from "react-router";
import { ArrowUpRight, Banknote, CircleX } from "lucide-react";
import { Modal } from "./shared.jsx";
import { canMarkPaid } from "./orderRules.js";

export default function OrderMenu({ order, close, choose }) {
  return (
    <Modal title="Order actions" subtitle={order.orderId} close={close}>
      <div className="ops-modal-body order-action-options">
        <Link className="cm-button" to={`/admin/orders/${order.id}`}>
          <ArrowUpRight size={17} aria-hidden="true" /> View order details
        </Link>
        {canMarkPaid(order) && (
          <button className="cm-button" onClick={() => choose("paid")}>
            <Banknote size={17} aria-hidden="true" /> Mark as paid
          </button>
        )}
        {["pending", "confirmed"].includes(order.orderStatus) && (
          <button className="cm-button cm-error" onClick={() => choose("cancel")}>
            <CircleX size={17} aria-hidden="true" /> Cancel order
          </button>
        )}
      </div>
    </Modal>
  );
}
