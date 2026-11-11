import RequestHistory from "./RequestHistory.jsx";
import { canRequestService } from "./requestEligibility.js";
import WalletRefundNotice from "./WalletRefundNotice.jsx";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router";
import { Download, Search, Package, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import ReplacementProgress from "./ReplacementProgress.jsx";
import CancelReturnButton from "./CancelReturnButton.jsx";
import API from "../../api/API.js";
import { money } from "../../utils/money.js";
import { payForOrder, reconcilePayment } from "./payment.js";
import {
  ProductRow,
  PriceSummary,
  DeliveryAddress,
  OrderTimeline,
} from "./PurchaseParts.jsx";
import {
  titleCase,
  orderDate,
  downloadInvoice,
  useCustomerOrder,
} from "./purchaseData.js";
import "../shop/shop.css";
import "./purchase.css";
import "./customer-orders.css";
import OrderCard from "./OrderCard.jsx";
import OrderInformation from "./OrderInformation.jsx";

export default function CustomerOrders({ addToCart }) {
  const { id } = useParams();
  return id ? <OrderDetails key={id} /> : <OrderList addToCart={addToCart} />;
}
function OrderList({ addToCart }) {
  const navigate = useNavigate();
  const [response, setResponse] = useState(null);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const query = new URLSearchParams({
    search: submitted, timeframe, status, sort, page, limit: 4,
  }).toString();
  const requestKey = `${query}:${reload}`;
  const data = response?.key === requestKey ? response.data : null;
  const error = response?.key === requestKey ? response.error : "";
  const loading = response?.key !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    API.get("/orders", {
      params: new URLSearchParams(query),
      signal: controller.signal,
    })
      .then(({ data }) => {
        if (!controller.signal.aborted)
          setResponse({ key: requestKey, data: data.data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey, data: null,
            error: error.response?.data?.message || error.message,
          });
      });
    return () => controller.abort();
  }, [query, requestKey]);

  async function run(key, task) {
    setBusy(key);
    setActionError("");
    try {
      await task();
    } catch (error) {
      setActionError(error.response?.data?.message || error.message);
    } finally {
      setBusy("");
    }
  }
  function clearFilters() {
    setSearch("");
    setSubmitted("");
    setTimeframe("");
    setStatus("");
    setSort("newest");
    setPage(1);
    setReload(value => value + 1);
  }
  const pagination = data?.pagination;
  const hasFilters = Boolean(submitted || timeframe || status);
  return (
    <main className="purchase-page shop-page orders-page">
      <header className="shop-heading orders-heading">
        <div>
          <h1>My Orders</h1>
          <p>View and manage your purchases.</p>
        </div>
        <span aria-live="polite">
          {loading ? "Loading orders…" : pagination ? `${pagination.total} orders` : ""}
        </span>
      </header>
      <form
        className="shop-filters shop-filter-bar orders-filter-bar"
        aria-label="Order filters"
        onSubmit={event => {
          event.preventDefault();
          setSubmitted(search.trim());
          setPage(1);
          setReload(value => value + 1);
        }}
      >
        <label className="orders-search-field">
          Search orders
          <span>
            <Search size={16} aria-hidden="true" />
            <input
              type="text"
              placeholder="Order ID, product or variant"
              maxLength={100}
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </span>
        </label>
        <label className="orders-timeframe-field">
          Timeframe
          <select aria-label="Filter by timeframe:" value={timeframe} onChange={event => {
            setTimeframe(event.target.value);
            setPage(1);
          }}>
            <option value="">All orders</option>
            <option value="3months">Past 3 months</option>
            <option value="6months">Past 6 months</option>
            <option value="year">Past year</option>
          </select>
        </label>
        <label className="orders-status-field">
          Status
          <select aria-label="Status" value={status} onChange={event => {
            setStatus(event.target.value);
            setPage(1);
          }}>
            <option value="">All statuses</option>
            {["pending", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"].map(value => (
              <option value={value} key={value}>{titleCase(value)}</option>
            ))}
          </select>
        </label>
        <label className="orders-sort-field">
          Sort by
          <select aria-label="Sort by" value={sort} onChange={event => {
            setSort(event.target.value);
            setPage(1);
          }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total-asc">Total: low to high</option>
            <option value="total-desc">Total: high to low</option>
          </select>
        </label>
        <button className="purchase-primary shop-filter-apply" type="submit">Search orders</button>
        <button className="shop-filter-clear orders-clear" type="button" onClick={clearFilters}>Clear</button>
      </form>
      {(error || actionError) && (
        <div role="alert" className="purchase-alert orders-alert">
          <span>{error || actionError}</span>
          {error && <button type="button" onClick={() => setReload(value => value + 1)}>Try again</button>}
        </div>
      )}
      <section className="orders-results" aria-label="Your orders" aria-busy={loading}>
        {loading && <p role="status" className="orders-loading">Loading your orders…</p>}
        {data?.orders.length === 0 && (
          <div className="orders-empty">
            <Package size={32} aria-hidden="true" />
            <h2>{hasFilters ? "No matching orders" : "Your orders will appear here"}</h2>
            <p>{hasFilters ? "Try another search or clear your filters." : "Explore the collection and find your next everyday essential."}</p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters}>Clear filters</button>
            ) : (
              <Link className="purchase-button purchase-primary" to="/products">Shop now <ArrowRight size={15} aria-hidden="true" /></Link>
            )}
          </div>
        )}
        {data?.orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            busy={Boolean(busy)}
            run={run}
            addToCart={addToCart}
            onCheckout={() => navigate("/checkout")}
          />
        ))}
      </section>
      {pagination && pagination.total > 0 && (
        <div className="purchase-pager orders-pager">
          <span>
            Showing {(pagination.page - 1) * 4 + 1}–
            {(pagination.page - 1) * 4 + data.orders.length} of {pagination.total} orders
          </span>
          <nav aria-label="Order pagination">
            <button disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}>
              <ChevronLeft size={14} aria-hidden="true" /> Previous
            </button>
            {[...new Set([1, pagination.page - 1, pagination.page, pagination.page + 1, pagination.totalPages])]
              .filter(number => number > 0 && number <= pagination.totalPages)
              .sort((a, b) => a - b)
              .map(number => (
                <button key={number} aria-label={`Page ${number}`} aria-current={number === pagination.page ? "page" : undefined} onClick={() => setPage(number)}>
                  {number}
                </button>
              ))}
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}>
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </nav>
        </div>
      )}
    </main>
  );
}

function OrderDetails() {
  const { id } = useParams(),
    navigate = useNavigate();
  const { order, setOrder, error } = useCustomerOrder(id);
  const [actionError, setActionError] = useState(""),
    [actionBusy, setBusy] = useState(false),
    [reason, setReason] = useState("");
  const [checking, setChecking] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [paymentCheckError, setPaymentCheckError] = useState("");
  const checkInFlight = useRef(false);
  const busy = actionBusy || checking;
  async function checkPayment() {
    if (busy || checkInFlight.current) return;
    checkInFlight.current = true;
    setChecking(true);
    setPaymentCheckError("");
    setPaymentFeedback("Checking the latest payment status…");
    try {
      const updated = await reconcilePayment(id);
      if (updated?.id !== id) throw new Error("Payment status could not be checked. Please retry.");
      setOrder(updated);
      setPaymentFeedback(updated.paymentStatus === "paid" ? "Payment confirmed. Your order has been updated." : updated.paymentStatus === "refunded" ? "Payment has been refunded. See your order’s refund details." : updated.paymentStatus === "failed" ? "Payment is still marked as failed. You can retry payment for this order." : "Payment is still pending. If money was deducted, wait briefly and check again before retrying.");
    } catch (e) {
      setPaymentFeedback("");
      setPaymentCheckError(e.response?.data?.message || e.message || "Payment status could not be checked. Please retry.");
    } finally {
      checkInFlight.current = false;
      setChecking(false);
    }
  }
  async function run(fn) {
    setBusy(true);
    setActionError("");
    try {
      await fn();
    } catch (e) {
      setActionError(e.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="purchase-page">
      {(error || actionError) && (
        <p className="purchase-alert" role="alert">
          {error || actionError}
        </p>
      )}
      {!order ? (
        !error && <p role="status">Loading order…</p>
      ) : (
        <>
          <div className="purchase-detail-title">
            <div>
              <small className="purchase-eyebrow">
                Placed {orderDate(order.createdAt)}
              </small>
              <h1>{order.orderId}</h1>
            </div>
            <button
              disabled={busy}
              onClick={() => run(() => downloadInvoice(order))}
            >
              <Download size={15} />
              Download PDF invoice
            </button>
          </div>
          <div className="purchase-columns">
            <div className="purchase-stack">
              <OrderTimeline order={order} />
              <section className="purchase-panel">
                <h2>Purchased Order</h2>
                {order.items.map((item, i) => (
                  <ProductRow key={i} item={item} />
                ))}
              </section>
              {["pending", "confirmed"].includes(order.orderStatus) && (
                <form
                  id="cancel"
                  className="purchase-panel"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(async () => {
                      const { data } = await API.post(`/orders/${id}/cancel`, {
                        reason,
                      });
                      setOrder(data.data.order);
                    });
                  }}
                >
                  <h2>Request cancellation</h2>
                  <p>Cancellation is available before your order is shipped.</p>
                  {order.paymentMethod === "razorpay" && order.paymentStatus === "paid" && <p>Cancellation refunds the paid amount to your Northstar Wallet.</p>}
                  <label className="purchase-field">
                    <span>Cancellation reason (optional)</span>
                    <input
                      value={reason}
                      maxLength={300}
                      onChange={(e) => setReason(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <button disabled={busy}>Cancel order</button>
                </form>
              )}
              {canRequestService(order) && (
                  <section className="purchase-panel">
                    <h2>Need to return your order?</h2>
                    <p>
                      Send a return request for review. All items in this order
                      are included.
                    </p>
                    <Link
                      className="purchase-button purchase-primary"
                      to={`/orders/${id}/return${order.returnRequest?.status && order.returnRequest.status !== "none" ? "?newRequest=1" : ""}`}
                    >
                      Return / replacement
                    </Link>
                  </section>
                )}
              {order.returnRequest?.status &&
                order.returnRequest.status !== "none" && (
                  <section className="purchase-panel">
                    <h2>{order.returnRequest.resolution === "replacement" ? "Replacement request" : "Return"}: {order.returnRequest.status}</h2>
                    <ReplacementProgress order={order} />
                    <p>{order.returnRequest.reason}</p>
                    <CancelReturnButton order={order} onUpdate={setOrder} />
                    {order.returnRequest.description && (
                      <p>{order.returnRequest.description}</p>
                    )}
                    {order.returnRequest.reviewNote && (
                      <p>Review: {order.returnRequest.reviewNote}</p>
                    )}
                  </section>
                )}
            </div>
            <div className="purchase-stack">
              <section className="purchase-panel">
                <div className="purchase-section-label">
                  <span>Payment summary</span>
                  <span>{titleCase(order.paymentStatus)}</span>
                </div>
                <p>
                  Payment: <b>{order.paymentStatus}</b> ·{" "}
                  {order.paymentMethod === "cod"
                    ? "Cash on delivery"
                    : order.paymentMethod === "wallet"
                      ? "Northstar Wallet"
                      : "Razorpay"}
                </p>
                <PriceSummary order={order} />
                <WalletRefundNotice order={order} />
                {paymentFeedback && <p role="status" aria-live="polite">{paymentFeedback}</p>}
                {paymentCheckError && <p className="purchase-alert" role="alert">{paymentCheckError}</p>}
                {order.paymentMethod === "razorpay" &&
                  !["paid", "refunded"].includes(order.paymentStatus) && (
                    <button
                      disabled={busy}
                      className="purchase-wide"
                      onClick={checkPayment}
                    >
                      {checking ? "Checking payment status…" : "Check payment status"}
                    </button>
                  )}
                {order.paymentMethod === "razorpay" &&
                  !["paid", "refunded"].includes(order.paymentStatus) &&
                  order.orderStatus !== "cancelled" && (
                    <button
                      className="purchase-primary purchase-wide"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          try {
                            await payForOrder(id);
                            navigate(`/orders/${id}/payment/success`);
                          } catch (e) {
                            navigate(`/orders/${id}/payment/failure`, {
                              state: {
                                paymentError:
                                  e.response?.data?.message || e.message,
                              },
                            });
                          }
                        })
                      }
                    >
                      Pay / retry payment
                    </button>
                  )}
                {order.refund?.status && order.refund.status !== "none" && (
                  <p>
                    Refund: {titleCase(order.refund.status)} ·{" "}
                    {money(order.refund.amount)}

                    {order.refund.reference && ` · ${order.refund.reference}`}
                  </p>
                )}
              </section>
              <section className="purchase-panel">
                <div className="purchase-section-label">Delivery address</div>
                <DeliveryAddress address={order.shippingAddress} />
              </section>
              <RequestHistory order={order} />
              <OrderInformation order={order} />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
