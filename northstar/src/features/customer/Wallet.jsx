import { useEffect, useState } from "react";
import { Link } from "react-router";
import { ShieldCheck, Wallet as WalletIcon } from "lucide-react";
import API from "../../api/API.js";
import { money } from "../../utils/money.js";
import "./customer.css";

export default function Wallet() {
  const [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    API.get(`/wallet?page=${page}&limit=10`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setResult(data.data);
          setError("");
        }
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            failure.response?.data?.message ||
              "Your wallet could not be loaded.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, revision]);
  function changePage(next) {
    setLoading(true);
    setPage(next);
  }
  return (
    <main className="customer-page wallet-page">
      <header className="customer-heading">
        <span className="customer-eyebrow">
          Account overview · Store credit
        </span>
        <h1>My Wallet</h1>
        <p>
          Use wallet credit for purchases and view refunds and transaction
          history.
        </p>
      </header>
      {error && (
        <div className="customer-error" role="alert">
          {error}{" "}
          <button
            onClick={() => {
              setLoading(true);
              setRevision((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
      {!result ? (
        !error && <p role="status">Loading wallet…</p>
      ) : (
        <>
          <section className="customer-card wallet-balance">
            <WalletIcon size={24} />
            <span className="customer-eyebrow">Total available balance</span>
            <strong>{money(result.balancePaise)}</strong>
            <div className="wallet-status">
              <span>
                <ShieldCheck size={17} />
                Wallet ID: {result.walletId}
              </span>
              <span className="customer-green">
                ● Available for store purchases
              </span>
            </div>
            <p className="customer-note">
              Choose Wallet at checkout when your balance covers the full order.
              Wallet credit cannot be withdrawn or transferred.
            </p>
          </section>
          <div className="customer-card-heading wallet-history-heading">
            <h2>Recent Transactions</h2>
            <span className="customer-eyebrow">Ledger currency: INR (₹)</span>
          </div>
          <div className="wallet-ledger" aria-busy={loading}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                      }).format(new Date(entry.createdAt))}
                    </td>
                    <td>
                      {entry.description}
                      {entry.orderId && (
                        <Link
                          className="wallet-order-link"
                          to={`/orders/${entry.orderId}`}
                        >
                          View order →
                        </Link>
                      )}
                    </td>
                    <td>
                      <span className="wallet-type">{entry.type}</span>
                    </td>
                    <td>
                      <span className="customer-green">● Completed</span>
                    </td>
                    <td
                      className={
                        entry.type === "credit" ? "customer-green" : ""
                      }
                    >
                      {entry.type === "credit" ? "+" : "−"}
                      {money(entry.amountPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!result.transactions.length && (
              <div className="wallet-empty">
                <h3>No transactions yet</h3>
                <p>
                  Your wallet purchases and wallet refunds will appear here.
                </p>
              </div>
            )}
            <div className="wallet-pagination">
              <span>
                {result.total
                  ? `Showing ${(result.page - 1) * result.limit + 1}–${Math.min(result.page * result.limit, result.total)} of ${result.total} transactions`
                  : "0 transactions"}
              </span>
              <div>
                <button
                  disabled={loading || page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  ‹ Previous
                </button>
                <button
                  disabled={loading || page >= result.pages}
                  onClick={() => changePage(page + 1)}
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
