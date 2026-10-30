import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="logo" to="/">NORTHSTAR</Link>
          <p>
            Explore the latest laptops, smartphones, and accessories from top brands.
            Built for work, play, and everything in between.
          </p>

          <div className="footer-socials">
              <a href="#" aria-label="Northstar on X">
    <img src="/x_icon.png" alt="X" />
  </a>
           <a href="#" aria-label="Northstar on Instagram">
    <img src="/instagram_icon.png" alt="Instagram" />
  </a>
             <a href="#" aria-label="Northstar on YouTube">
    <img src="/yt_icon.png" alt="YouTube  " />
  </a>
          </div>
        </div>
        <nav className="footer-links" aria-label="Quick links">
          <h2>Quick Links</h2>
          <Link to="/profile">My Profile</Link>
          <Link to="/addresses">Saved Addresses</Link>
          <a href="#">Return Request</a>        </nav>

        <nav className="footer-links" aria-label="Legal and policies">
          <h2>Legal &amp; Policies</h2>
          <a href="#">Terms of Service</a>
          <a href="#">Privacy &amp; Security</a>
          <a href="#">Refund Policy</a>
        </nav>
      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} NORTHSTAR Electronics Ltd.
          All rights reserved.
        </p>

        <div className="footer-payments">
          <span>Payment methods</span>
          <span className="payment-badge">Visa</span>
          <span className="payment-badge">UPI</span>
          <span className="payment-badge">Razorpay</span>
        </div>
      </div>
    </footer>
  );
}
