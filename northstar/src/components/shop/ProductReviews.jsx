import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AuthContext } from "../../context/AuthContext.js";
import { shopApi } from "../../api/shop.js";
import ReviewPhotos, { ReviewImageInput } from "./ReviewPhotos.jsx";

const emptyForm = { rating: 5, title: "", text: "", recommends: true };
function Stars({ rating }) {
  return (
    <span className="pd-stars" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.round(rating))}
      {"☆".repeat(5 - Math.round(rating))}
    </span>
  );
}
export default function ProductReviews({ productId, onSummary }) {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [images, setImages] = useState([]);
  const [files, setFiles] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const result = await shopApi.reviews(
          productId,
          page,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setData(result);
        onSummary(result.summary);
        setError("");
        if (user?.role === "customer") {
          const status = await shopApi.reviewEligibility(
            productId,
            controller.signal,
          );
          if (!controller.signal.aborted) setEligibility(status);
        }
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      }
    }
    load();
    return () => controller.abort();
  }, [productId, page, reload, user?.id, user?.role, onSummary]);
  function write() {
    if (!user) {
      navigate(
        `/?signin=1&next=${encodeURIComponent(`/products/${productId}`)}`,
      );
      return;
    }
    setForm(
      eligibility?.review
        ? {
            rating: eligibility.review.rating,
            title: eligibility.review.title,
            text: eligibility.review.text,
            recommends: eligibility.review.recommends,
          }
        : emptyForm,
    );
    setWriting(true);
    setImages(eligibility?.review?.images || []);
    setFiles([]);
    setError("");
    setNotice("");
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set(
        "data",
        JSON.stringify({
          ...form,
          retainedImageIds: images.map((image) => image.id),
        }),
      );
      files.forEach((file) => body.append("images", file));
      const result = await shopApi.saveReview(productId, body);
      setEligibility({ canReview: true, reason: "", review: result.review });
      setFiles([]);
      setWriting(false);
      setNotice("Your review has been saved.");
      setPage(1);
      setReload((value) => value + 1);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="pd-reviews" id="reviews">
      <div className="pd-section-heading">
        <div>
          <p className="pd-eyebrow">Customer feedback</p>
          <h2>Customer Reviews</h2>
        </div>
        <div className="pd-review-actions">
          {data?.summary.count > 0 && (
            <div className="pd-rating-summary">
              <strong>{data.summary.average.toFixed(2)}</strong>
              <div>
                <Stars rating={data.summary.average} />
                <small>
                  {data.summary.recommendPercent}% recommend ·{" "}
                  {data.summary.count} reviews
                </small>
              </div>
            </div>
          )}
          <button type="button" className="shop-primary" onClick={write}>
            {eligibility?.review ? "Edit your review" : "Write a review"}
          </button>
        </div>
      </div>
      {notice && (
        <p className="shop-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="shop-error" role="alert">
          {error}{" "}
          <button type="button" onClick={() => setReload((value) => value + 1)}>
            Try again
          </button>
        </p>
      )}
      {writing && (
        <div className="pd-review-form">
          {user?.role !== "customer" || !eligibility?.canReview ? (
            <p className="shop-help">
              {user?.role !== "customer"
                ? "Reviews are written by customer accounts."
                : eligibility?.reason || "Loading your review…"}
            </p>
          ) : (
            <form onSubmit={save}>
              <h3>
                {eligibility.review
                  ? "Edit your review"
                  : "Share your experience"}
              </h3>
              <label>
                Rating
                <select
                  value={form.rating}
                  onChange={(event) =>
                    setForm({ ...form, rating: Number(event.target.value) })
                  }
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Title
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={form.title}
                  onChange={(event) =>
                    setForm({ ...form, title: event.target.value })
                  }
                />
              </label>
              <label>
                Your review
                <textarea
                  required
                  minLength={10}
                  maxLength={1000}
                  rows={4}
                  value={form.text}
                  onChange={(event) =>
                    setForm({ ...form, text: event.target.value })
                  }
                />
              </label>
              <ReviewImageInput
                images={images}
                files={files}
                onImagesChange={setImages}
                onFilesChange={setFiles}
                onError={setError}
                disabled={busy}
              />
              <label className="pd-check">
                <input
                  type="checkbox"
                  checked={form.recommends}
                  onChange={(event) =>
                    setForm({ ...form, recommends: event.target.checked })
                  }
                />{" "}
                I recommend this product
              </label>
              <button className="shop-primary" disabled={busy}>
                {busy ? "Saving…" : "Save review"}
              </button>
            </form>
          )}
          <button
            type="button"
            className="pd-text-button"
            disabled={busy}
            onClick={() => setWriting(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {!data && !error && <p role="status">Loading reviews…</p>}
      {data && (
        <>
          {!data.reviews.length && (
            <p className="shop-help">
              No reviews yet. Share your experience with this product.
            </p>
          )}
          <div className="pd-review-grid">
            {data.reviews.map((review) => (
              <article key={review.id} className="pd-review-card">
                <div className="pd-review-top">
                  <strong>{review.customerName}</strong>
                  <Stars rating={review.rating} />
                </div>
                <p className="pd-review-meta">
                  <span>Customer review</span>
                  <time dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </time>
                </p>
                <h3>{review.title}</h3>
                <p>{review.text}</p>
                <ReviewPhotos images={review.images} />
              </article>
            ))}
          </div>
          {data.pagination.totalPages > 1 && (
            <nav className="shop-pagination" aria-label="Review pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous reviews
              </button>
              <span>
                {data.pagination.page} / {data.pagination.totalPages}
              </span>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next reviews
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
