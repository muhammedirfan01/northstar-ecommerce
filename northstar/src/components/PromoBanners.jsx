import { Link } from "react-router";

export default function PromoBanners({ mobileLink, audioLink }) {
  return (
    <section className="promo-banners" aria-label="Special offers">
      <article className="promo-card promo-dark">
        <div>
          <span className="promo-label">FLASH SALE · FLAT 50% OFF</span>

          <h2>
            Upgrade Your
            <br />
            Smartphone
          </h2>

          <p>Get up to 25% off on the latest models.</p>

          <Link
            className="promo-button"
            to={mobileLink || "#"}
            aria-disabled={!mobileLink}
            onClick={(event) => {
              if (!mobileLink) event.preventDefault();
            }}
          >
            Shop Mobiles →
          </Link>
        </div>

        <img
          className="promo-image"
          src="/promo_image1.png"
          alt="Close-up of a smartphone"
          loading="lazy"
        />
      </article>

      <article className="promo-card">
        <div>
          <span className="promo-label">LIMITED OFFER: 50% OFF</span>

          <h2>
            Immersive Sound
            <br />
            Experience
          </h2>

          <p>Top brands. Unbeatable quality.</p>

          <Link
            className="promo-button"
            to={audioLink || "#"}
            aria-disabled={!audioLink}
            onClick={(event) => {
              if (!audioLink) event.preventDefault();
            }}
          >
            Shop Headphones →
          </Link>
        </div>

        <img
          className="promo-image"
          src="/promo_image2.png"
          alt="Headphones arranged on a desk"
          loading="lazy"
        />
      </article>
    </section>
  );
}
