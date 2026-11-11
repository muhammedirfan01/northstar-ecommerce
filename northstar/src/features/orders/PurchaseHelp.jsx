import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Mail, Phone, ArrowUpRight } from "lucide-react";
import API from "../../api/API.js";

export default function PurchaseHelp() {
  const [contact, setContact] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    API.get("/support", { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setContact(data.data); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <section className="purchase-care" aria-label="Customer care">
      <div><h2>Customer care</h2><p>Need help with your order? We’re here to help.</p></div>
      <div className="purchase-care-links">
        {contact?.phone && <a href={`tel:${contact.phone}`}><Phone size={17} aria-hidden="true" />{contact.phone}</a>}
        {contact?.email && <a href={`mailto:${contact.email}`}><Mail size={17} aria-hidden="true" />{contact.email}</a>}
        <Link to="/support">Contact support <ArrowUpRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
