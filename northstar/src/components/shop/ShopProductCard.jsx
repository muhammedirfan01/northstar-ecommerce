import { useContext, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Heart } from "lucide-react";
import { ShoppingContext } from "../../context/ShoppingContext.js";
import {
  selectedVariant,
  variantImage,
  variantConfiguration,
} from "../../utils/variants.js";
import { money } from "../../utils/money.js";
import "./shop.css";

export default function ShopProductCard({ product }) {
  const { wishlistIds, toggleWishlist, addToCart } =
    useContext(ShoppingContext);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();
  const available = product.available !== false;
  const variant = selectedVariant(product);
  const price = variant?.pricePaise ?? product.pricePaise;
  const regularPrice = variant
    ? variant.regularPricePaise
    : product.regularPricePaise;
  async function act(kind) {
    setBusy(true);
    setNotice("");
    try {
      if (kind === "wish") await toggleWishlist(product.id);
      else if (product.variants.length && !variant)
        navigate(`/products/${product.id}`);
      else if (await addToCart(product.id, variant?.id || null))
        setNotice("Added to cart.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="shop-product-card">
      <div className="shop-card-image">
        <Link to={available ? `/products/${product.id}` : "/products"}>
          <img
            src={variantImage(product, variant)}
            alt={product.name}
            loading="lazy"
          />
        </Link>
        <div className="pd-card-badges">
          {product.badge && <span>{product.badge}</span>}
          {available && product.regularPricePaise > product.pricePaise && (
            <span className="pd-card-sale">
              {Math.round(
                ((product.regularPricePaise - product.pricePaise) /
                  product.regularPricePaise) *
                  100,
              )}
              % off
            </span>
          )}
        </div>
        <button
          type="button"
          className="shop-heart"
          aria-label={`${wishlistIds.includes(product.id) ? "Remove" : "Add"} ${product.name} ${wishlistIds.includes(product.id) ? "from" : "to"} wishlist`}
          aria-pressed={wishlistIds.includes(product.id)}
          disabled={busy}
          onClick={() => act("wish")}
        >
          <Heart
            size={19}
            fill={wishlistIds.includes(product.id) ? "currentColor" : "none"}
          />
        </button>
      </div>
      <small>{product.series || product.category?.name}</small>
      <h2>
        <Link to={available ? `/products/${product.id}` : "/products"}>
          {product.name}
        </Link>
      </h2>
      {product.subtitle && (
        <p className="pd-card-subtitle">{product.subtitle}</p>
      )}
      {variant && (
        <p className="shop-card-variant">{variantConfiguration(variant)}</p>
      )}
      <p className="shop-card-price">
        {available ? (
          <>
            {money(price)}{" "}
            {product.regularPricePaise > product.pricePaise && (
              <del>{money(regularPrice)}</del>
            )}
          </>
        ) : (
          "Currently unavailable"
        )}
      </p>
      <button
        className="shop-primary"
        type="button"
        disabled={busy || !available}
        onClick={() => act("cart")}
      >
        {!available ? "Unavailable" : "Add to cart"}
      </button>
      {notice && (
        <p className="shop-feedback" role="status">
          {notice}
        </p>
      )}
    </article>
  );
}
