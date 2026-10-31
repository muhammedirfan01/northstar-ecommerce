import { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Heart, ShoppingBag } from "lucide-react";
import { shopApi } from "../api/shop.js";
import { ShoppingContext } from "../context/ShoppingContext.js";
import ShopProductCard from "../components/shop/ShopProductCard.jsx";
import ImageZoom from "../components/shop/ImageZoom.jsx";
import ProductImageMagnifier from "../components/shop/ProductImageMagnifier.jsx";
import ProductVariantOptions from "../components/shop/ProductVariantOptions.jsx";
import ProductReviews from "../components/shop/ProductReviews.jsx";
import { selectedVariant } from "../utils/variants.js";
import { money } from "../utils/money.js";
import "../components/shop/product-details.css";

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, wishlistIds } =
    useContext(ShoppingContext);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [reviewSummary, setReviewSummary] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    shopApi
      .product(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
          const initial = selectedVariant(result.product);
          setVariantId(initial?.id || "");
          setQuantity(1);
          setImageIndex(
            initial?.images?.length
              ? 0
              : Math.max(
                  0,
                  result.product.images.findIndex(
                    (image) => image.id === initial?.imageId,
                  ),
                ),
          );
          setNotice("");
          setReviewSummary(null);
          setZoom(false);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error.status === 404 || error.status === 400)
          navigate("/products", {
            replace: true,
            state: {
              notice:
                "That product is unavailable. Browse other products below.",
            },
          });
        else setError(error.message);
      });
    return () => controller.abort();
  }, [id, navigate, reload]);
  if (error)
    return (
      <main className="shop-page">
        <p role="alert" className="shop-error">
          {error}
        </p>
        <button onClick={() => setReload(reload + 1)}>Try again</button>
      </main>
    );
  if (!data || data.product.id !== id)
    return (
      <main className="shop-page" role="status">
        Loading product…
      </main>
    );
  const { product, related } = data;
  const variant = product.variants.find((item) => item.id === variantId);
  const price = variant?.pricePaise ?? product.pricePaise;
  const regularPrice = variant
    ? variant.regularPricePaise
    : product.regularPricePaise;
  const stock = variant?.stock ?? product.stock;
  const maxQuantity = Math.min(stock, 5);
  const discount =
    regularPrice > price
      ? Math.round(((regularPrice - price) / regularPrice) * 100)
      : 0;
  const gallery = variant?.images?.length ? variant.images : product.images;
  const image = gallery[imageIndex] || gallery[0];
  function selectVariant(value) {
    setVariantId(value);
    setQuantity(1);
    setNotice("");
    const selected = product.variants.find((item) => item.id === value);
    if (selected?.images?.length) {
      setImageIndex(0);
      return;
    }
    const index = product.images.findIndex(
      (item) => item.id === selected?.imageId,
    );
    setImageIndex(Math.max(0, index));
  }
  async function act(kind) {
    setBusy(true);
    setNotice("");
    try {
      if (kind === "wish") await toggleWishlist(product.id);
      else {
        if (product.variants.length && !variant)
          throw new Error("Choose a variant first.");
        if (
          await addToCart(
            product.id,
            variant?.id || null,
            Math.min(quantity, maxQuantity),
          )
        ) {
          if (kind === "buy") navigate("/cart");
          else setNotice("Added to cart.");
        }
      }
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="shop-page pd-page">
      <div className="pd-hero">
        <section className="pd-gallery" aria-label="Product gallery">
          <div className="pd-gallery-main">
            <div className="pd-badges">
              {product.badge && (
                <span className="pd-badge">{product.badge}</span>
              )}
              {discount > 0 && (
                <span className="pd-badge pd-sale">{discount}% off</span>
              )}
              <span className="pd-image-count">
                {gallery.length} product{" "}
                {gallery.length === 1 ? "image" : "images"}
              </span>
            </div>
            <ProductImageMagnifier
              key={image.url}
              image={image}
              productName={product.name}
              onEnlarge={() => setZoom(true)}
            />
            <button
              className="pd-save"
              type="button"
              aria-label={
                wishlistIds.includes(product.id)
                  ? "Remove from wishlist"
                  : "Save to wishlist"
              }
              aria-pressed={wishlistIds.includes(product.id)}
              disabled={busy}
              onClick={() => act("wish")}
            >
              <Heart
                size={19}
                fill={
                  wishlistIds.includes(product.id) ? "currentColor" : "none"
                }
              />
            </button>
          </div>
          <div className="pd-thumbnails">
            {gallery.map((item, index) => (
              <button
                type="button"
                key={item.id}
                aria-label={`View image ${index + 1}`}
                aria-pressed={imageIndex === index}
                onClick={() => setImageIndex(index)}
              >
                <img src={item.url} alt="" />
              </button>
            ))}
          </div>
          <p className="shop-breadcrumb pd-breadcrumb">
            <Link to="/">Home</Link> /{" "}
            <Link to={`/products?category=${product.category.id}`}>
              {product.category.name}
            </Link>{" "}
            / <span>{product.name}</span>
          </p>
        </section>
        <section className="pd-info">
          <p className="pd-eyebrow">
            {product.series || product.category.name}
          </p>
          <h1>{product.name}</h1>
          {product.subtitle && (
            <p className="pd-subtitle">{product.subtitle}</p>
          )}
          <a className="pd-rating-link" href="#reviews">
            {reviewSummary?.count > 0 ? (
              <>
                <span className="pd-stars" aria-hidden="true">
                  {"★".repeat(Math.round(reviewSummary.average))}
                  {"☆".repeat(5 - Math.round(reviewSummary.average))}
                </span>
                <strong>{reviewSummary.average.toFixed(2)}</strong>
                <span>
                  ({reviewSummary.count}{" "}
                  {reviewSummary.count === 1 ? "review" : "reviews"})
                </span>
              </>
            ) : (
              "No reviews yet · Be the first to review"
            )}
          </a>
          <div className="pd-pricing">
            <div className="pd-price-row">
              <strong>{money(price)}</strong>
              {regularPrice > price && (
                <>
                  <del>{money(regularPrice)}</del>
                  <span className="pd-saving">
                    Save {money(regularPrice - price)} ({discount}% off)
                  </span>
                </>
              )}
            </div>
            {product.priceNote && <p>{product.priceNote}</p>}
          </div>
          {product.variants.length > 0 && (
            <ProductVariantOptions
              key={product.id}
              variants={product.variants}
              value={variantId}
              onChange={selectVariant}
              basePrice={product.pricePaise}
            />
          )}
          <div className="pd-stock-row">
            <p className="shop-stock">
              {variant
                ? `${stock} in stock`
                : product.variants.length
                  ? "Select your configuration to check stock"
                  : `${stock} in stock`}
            </p>
            <label>
              Quantity
              <select
                aria-label="Quantity"
                value={Math.min(quantity, maxQuantity)}
                onChange={(event) => setQuantity(Number(event.target.value))}
              >
                {Array.from({ length: maxQuantity }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="pd-purchase-buttons">
            <button
              type="button"
              className="shop-secondary"
              disabled={busy || !maxQuantity}
              onClick={() => act("cart")}
            >
              <ShoppingBag size={16} /> Add to cart
            </button>
            <button
              type="button"
              className="shop-primary"
              disabled={busy || !maxQuantity}
              onClick={() => act("buy")}
            >
              Buy now{discount > 0 ? ` with ${discount}% off` : ""}
            </button>
          </div>
          <p className="shop-help">
            Maximum 5 units per option. Buy now adds your selection to the cart
            for review.
          </p>
          {notice && (
            <p className="shop-notice" role="status">
              {notice}
            </p>
          )}
          <Link className="pd-text-button" to="/cart">
            View cart →
          </Link>
          {product.highlights.length > 0 && (
            <ul className="pd-highlights">
              {product.highlights.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="pd-overview">
        <p className="pd-eyebrow">Product information</p>
        <h2>About this product</h2>
        <p className="pd-description">{product.description}</p>
        {product.quickSpecs?.length > 0 && (
          <>
            <h3 className="pd-subheading">● Quick product details</h3>
            <div className="pd-quick-specs">
              {product.quickSpecs.map((spec, index) => (
                <article key={index}>
                  <span>{spec.label}</span>
                  <strong>{spec.value}</strong>
                  {spec.note && <p>{spec.note}</p>}
                </article>
              ))}
            </div>
          </>
        )}
        {product.specifications.length > 0 && (
          <>
            <h3 className="pd-subheading">● Detailed product specifications</h3>
            <dl className="pd-spec-table">
              {product.specifications.map((item, index) => {
                const colon = item.indexOf(":");
                return (
                  <div key={index}>
                    <dt>
                      {colon >= 0
                        ? item.slice(0, colon).trim()
                        : `Specification ${index + 1}`}
                    </dt>
                    <dd>{colon >= 0 ? item.slice(colon + 1).trim() : item}</dd>
                  </div>
                );
              })}
            </dl>
          </>
        )}
      </section>
      <ProductReviews
        key={product.id}
        productId={product.id}
        onSummary={setReviewSummary}
      />
      {related.length > 0 && (
        <section className="pd-related">
          <div className="pd-section-heading">
            <div>
              <p className="pd-eyebrow">More {product.category.name}</p>
              <h2>Related products</h2>
            </div>
            <Link to={`/products?category=${product.category.id}`}>
              View all {product.category.name} →
            </Link>
          </div>
          <div className="pd-related-grid">
            {related.slice(0, 3).map((item) => (
              <ShopProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
      {zoom && <ImageZoom image={image} onClose={() => setZoom(false)} />}
    </main>
  );
}
