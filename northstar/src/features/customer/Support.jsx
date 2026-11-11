import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Mail, Phone, MapPin, ArrowUpRight, Check } from "lucide-react";
import API from "../../api/API.js";
import "./customer.css";
import "./support.css";

export default function Support({ user }) {
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ticket, setTicket] = useState(null);
  const request = useRef({ key: crypto.randomUUID(), payload: "" });
  useEffect(() => {
    const controller = new AbortController();
    API.get("/support", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setContact(data.data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(
      ["name", "email", "subject", "message"].map((key) => [
        key,
        form.get(key).trim(),
      ]),
    );
    const payload = JSON.stringify(body);
    if (request.current.payload && request.current.payload !== payload)
      request.current.key = crypto.randomUUID();
    request.current.payload = payload;
    setBusy(true);
    setError("");
    try {
      const { data } = await API.post("/support", {
        ...body,
        requestId: request.current.key,
      });
      setTicket(data.data);
    } catch (failure) {
      setError(
        failure.response?.data?.message ||
          "Your message could not be sent. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="customer-page support-page">
      <header className="customer-heading">
        <h1>Contact Us</h1>
      </header>
      <div className="support-grid">
        <section className="customer-card support-form">
          {ticket ? (
            <div role="status" className="support-confirmation">
              <Check size={32} />
              <h2>Message received</h2>
              <p>
                Your request has been saved with reference{" "}
                <strong>{ticket.reference}</strong>.
              </p>
              <p>
                Our support team will review your message. Keep this reference
                when contacting us.
              </p>
              <button
                className="customer-primary"
                onClick={() => {
                  setTicket(null);
                  request.current = { key: crypto.randomUUID(), payload: "" };
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <>
              <div className="customer-card-heading">
                <h2>Send Us a Message</h2>
              </div>
              <form onSubmit={submit} aria-busy={busy}>
                <fieldset disabled={busy} className="customer-form-grid">
                  <label>
                    Your name
                    <input
                      name="name"
                      defaultValue={user?.name || ""}
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      required
                    />
                  </label>
                  <label>
                    Your email address
                    <input
                      name="email"
                      defaultValue={user?.email || ""}
                      type="email"
                      maxLength={254}
                      autoComplete="email"
                      required
                    />
                  </label>
                  <label className="customer-field-wide">
                    Subject
                    <input
                      name="subject"
                      placeholder="Order, product, or account question"
                      minLength={3}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label className="customer-field-wide">
                    Message
                    <textarea
                      name="message"
                      placeholder="How can we help? Include your order ID if needed."
                      minLength={10}
                      maxLength={3000}
                      rows={4}
                      required
                    />
                  </label>
                </fieldset>
                {error && (
                  <p role="alert" className="customer-error">
                    {error}
                  </p>
                )}
                <p className="customer-note">
                  We use these details to handle your request.{" "}
                  <Link to="/privacy-policy">Privacy Policy</Link>
                </p>
                <button className="customer-primary" disabled={busy}>
                  {busy ? "Sending…" : "Send message"}
                  <ArrowUpRight size={16} />
                </button>
              </form>
            </>
          )}
        </section>
        <aside className="support-aside">
          {contact?.address && (
            <section className="customer-card">
              <MapPin size={20} />
              <span className="customer-eyebrow">Store information</span>
              <h2>{contact.storeName}</h2>
              <p style={{ whiteSpace: "pre-line" }}>{contact.address}</p>
            </section>
          )}
          {contact?.phone && (
            <section className="customer-card">
              <Phone size={20} />
              <span className="customer-eyebrow">Talk to us</span>
              <h2>Customer Care</h2>
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>
                {contact.phone}
              </a>
            </section>
          )}
          <section className="customer-card">
            <Mail size={20} />
            <span className="customer-eyebrow">Orders & account</span>
            <h2>A little guidance</h2>
            <p>
              View your delivery progress, cancellation eligibility, and return
              updates in your account.
            </p>
            <div className="customer-link-list">
              <Link to="/orders">View my orders →</Link>
              <Link to="/shipping-policy">Shipping & delivery</Link>
              <Link to="/terms-and-conditions">Returns & cancellations</Link>
            </div>
            {contact?.email && (
              <p>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
