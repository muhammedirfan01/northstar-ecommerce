import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { productApi } from "../../api/catalog.js";
import ConfirmAction from "./ConfirmAction.jsx";
import ReviewPhotos from "../../components/shop/ReviewPhotos.jsx";
import "./catalog.css";

export default function ProductReviews() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    productApi
      .reviews(id, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, page, reload]);
  async function change(review, remove = false) {
    setBusy(true);
    setError("");
    try {
      if (remove) await productApi.removeReview(id, review.id);
      else await productApi.reviewStatus(id, review.id, !review.isListed);
      setDeleting(null);
      setReload((value) => value + 1);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="cm-page catalog-page">
      <Link className="catalog-back" to={`/admin/products/${id}/edit`}>
        ← Back to product
      </Link>
      <div className="cm-heading">
        <div>
          <p className="cm-breadcrumb">Catalog / Products / Reviews</p>
          <h1>Customer Reviews</h1>
          <p>{data?.productName}</p>
        </div>
      </div>
      <p className="catalog-help">
        Reviews are written by signed-in customers. You can list/unlist or
        permanently delete them. Ratings are calculated from listed reviews.
      </p>
      {error && !deleting && (
        <p className="cm-notice cm-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Loading reviews…</p>}
      {data && (
        <>
          <div className="cm-table-card">
            <div className="cm-table-scroll">
              <table className="cm-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Review</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reviews.map((review) => (
                    <tr key={review.id}>
                      <td>
                        {review.customerName}
                        <small className="catalog-variant-caption">
                          {new Date(review.createdAt).toLocaleDateString(
                            "en-IN",
                          )}
                        </small>
                      </td>
                      <td>{review.rating} / 5</td>
                      <td className="catalog-review-text">
                        <strong>{review.title}</strong>
                        <p>{review.text}</p>
                        <ReviewPhotos images={review.images} />
                      </td>
                      <td>{review.isListed ? "Listed" : "Unlisted"}</td>
                      <td>
                        <div className="catalog-row-actions">
                          <button
                            className="cm-button"
                            disabled={busy}
                            onClick={() => change(review)}
                          >
                            {review.isListed ? "Unlist" : "List"}
                          </button>
                          <button
                            className="cm-button cm-delete"
                            disabled={busy}
                            onClick={() => setDeleting(review)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.reviews.length && (
              <p className="cm-empty">No customer reviews yet.</p>
            )}
          </div>
          {data.pagination.totalPages > 1 && (
            <nav className="catalog-actions" aria-label="Review pagination">
              <button
                className="cm-button"
                disabled={busy || data.pagination.page <= 1}
                onClick={() => setPage(data.pagination.page - 1)}
              >
                Previous
              </button>
              <span>
                {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <button
                className="cm-button"
                disabled={
                  busy || data.pagination.page >= data.pagination.totalPages
                }
                onClick={() => setPage(data.pagination.page + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
      {deleting && (
        <ConfirmAction
          title="Delete review permanently?"
          description={`The review “${deleting.title}” will be permanently removed.`}
          danger
          busy={busy}
          error={error}
          onClose={() => setDeleting(null)}
          onConfirm={() => change(deleting, true)}
        />
      )}
    </section>
  );
}
