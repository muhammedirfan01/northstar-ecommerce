import { images } from "../../assets/images.js";
import { Link } from "react-router";
export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="logo" to="/">
            NORTHSTAR
          </Link>
          <p>
            Explore the latest laptops, smartphones, and accessories from top
            brands. Built for work, play, and everything in between.
          </p>

          <div className="footer-socials">
            <span
              aria-label="Northstar on X (coming soon)"
              title="Coming soon"
              aria-disabled="true"
            >
              <img src={images.x} alt="X" />
            </span>
            <span
              aria-label="Northstar on Instagram (coming soon)"
              title="Coming soon"
              aria-disabled="true"
            >
              <img src={images.instagram} alt="Instagram" />
            </span>
            <span
              aria-label="Northstar on YouTube (coming soon)"
              title="Coming soon"
              aria-disabled="true"
            >
              <img src={images.youtube} alt="YouTube  " />
            </span>
          </div>
        </div>
        <nav className="footer-links" aria-label="Quick links">
          <h2>Quick Links</h2>
          <Link to="/profile">My Profile</Link>
          <Link to="/addresses">Saved Addresses</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/cart">Cart</Link>
        </nav>

        <nav className="footer-links" aria-label="Legal and policies">
          <h2>Legal &amp; Policies</h2>
          <span
            className="footer-unavailable"
            title="Coming soon"
            aria-disabled="true"
          >
            Terms of Service
          </span>
          <span
            className="footer-unavailable"
            title="Coming soon"
            aria-disabled="true"
          >
            Privacy &amp; Security
          </span>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} NORTHSTAR Electronics Ltd. All rights
          reserved.
        </p>
      </div>
    </footer>
  );
}
