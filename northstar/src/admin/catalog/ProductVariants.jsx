import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { Plus } from "lucide-react";
import { productApi } from "../../api/catalog.js";
import VariantOptionFields from "./VariantOptionFields.jsx";
import ImageUploader from "./ImageUploader.jsx";
import ConfirmAction from "./ConfirmAction.jsx";
import "../customers.css";
import "./catalog.css";

const empty = {
  options: [],
  isDefault: false,
  colorHex: "",
  imageId: "",
  name: "",
  price: "",
  regularPrice: "",
  stock: "0",
  isListed: true,
};
export default function ProductVariants() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    productApi
      .get(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProduct(result.product);
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, [id, reload]);
  function edit(variant = {}) {
    setEditing(variant);
    setImages(variant.images || []);
    setForm(
      variant.id
        ? {
            options: variant.options || [],
            isDefault: product.defaultVariantId === variant.id,
            colorHex: variant.colorHex || "",
            imageId: variant.imageId || "",
            name: variant.name,
            price: String(variant.pricePaise / 100),
            regularPrice: variant.regularPricePaise
              ? String(variant.regularPricePaise / 100)
              : "",
            stock: String(variant.stock),
            isListed: variant.isListed,
          }
        : empty,
    );
    setError("");
  }
  function change(name, value) {
    setForm({ ...form, [name]: value });
  }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const options = form.options.filter(
        (option) => option.name.trim() || option.value.trim(),
      );
      const hasColour = options.some((option) =>
        /^(color|colour)$/i.test(option.name.trim()),
      );
      const body = new FormData();
      body.set(
        "data",
        JSON.stringify({
          ...form,
          options,
          colorHex: hasColour ? form.colorHex || "#222222" : "",
          retainedImageIds: images
            .filter((image) => image.id)
            .map((image) => image.id),
        }),
      );
      images
        .filter((image) => image.file)
        .forEach((image) => body.append("images", image.file));
      const result = await productApi.saveVariant(id, editing.id, body);
      setProduct(result.product);
      setEditing(null);
      setMessage("Variant saved. Product price and stock have been updated.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError("");
    try {
      const result = await productApi.removeVariant(id, deleting.id);
      setProduct(result.product);
      setDeleting(null);
      setMessage("Variant deleted. Product stock has been updated.");
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (!product)
    return error ? (
      <p className="cm-notice cm-error" role="alert">
        {error}
        <button type="button" onClick={() => setReload(reload + 1)}>
          Try again
        </button>
      </p>
    ) : (
      <p role="status">Loading variants…</p>
    );
  return (
    <section className="cm-page catalog-page">
      <Link className="catalog-back" to={`/admin/products/${id}/edit`}>
        ← Back to product
      </Link>
      <p className="cm-breadcrumb">Catalog / Products / Variants</p>
      <div className="cm-heading">
        <div>
          <h1>Product Variants</h1>
          <p>
            {product.name} · Total listed stock: {product.stock}
          </p>
        </div>
        <button
          className="catalog-primary"
          type="button"
          onClick={() => edit()}
          disabled={busy || Boolean(editing)}
        >
          <Plus size={16} /> Add variant
        </button>
      </div>
      <p className="catalog-help">
        Name each combination clearly, for example “Burgundy / 256 GB”. Use any
        option names. Each variant has its own images, price and stock. Choose a
        default for customer listings.
      </p>
      {message && (
        <p className="cm-notice" role="status">
          {message}
        </p>
      )}
      {error && !deleting && (
        <p className="cm-notice cm-error" role="alert">
          {error}
        </p>
      )}
      {editing && (
        <form className="catalog-card" onSubmit={save}>
          <h2>{editing.id ? "Edit variant" : "Add variant"}</h2>
          <fieldset className="catalog-form-fieldset" disabled={busy}>
            <div className="catalog-form-grid">
              <label className="catalog-wide">
                Variant name *
                <input
                  value={form.name}
                  onChange={(event) => change("name", event.target.value)}
                  minLength={2}
                  maxLength={120}
                  required
                  autoFocus
                />
              </label>
              <VariantOptionFields
                options={form.options}
                onChange={(options) => change("options", options)}
              />
              {form.options.some((option) =>
                /^(color|colour)$/i.test(option.name.trim()),
              ) && (
                <label>
                  Colour swatch
                  <input
                    type="color"
                    value={form.colorHex || "#222222"}
                    onChange={(event) => change("colorHex", event.target.value)}
                  />
                </label>
              )}
              <label className="catalog-wide catalog-checkbox">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(event) =>
                    change("isDefault", event.target.checked)
                  }
                />{" "}
                Use as the default variant on the storefront
              </label>
              <section className="catalog-wide">
                <h3>Images for this variant / colour</h3>
                <p className="catalog-help">
                  Upload up to six images, then crop them. Other variants can
                  have their own images. The first image is shown on product
                  cards and in the cart.
                </p>
                <ImageUploader
                  images={images}
                  onChange={setImages}
                  disabled={busy}
                />
              </section>
              <label className="catalog-wide">
                Fallback product image
                <select
                  value={form.imageId}
                  onChange={(event) => change("imageId", event.target.value)}
                >
                  <option value="">Use product gallery</option>
                  {product.images.map((image, index) => (
                    <option key={image.id} value={image.id}>
                      Product image {index + 1}
                    </option>
                  ))}
                </select>
              </label>
              <p className="catalog-help catalog-wide">
                If this variant has no uploaded images, the selected product
                image is used.
              </p>
              <label>
                Selling price (₹) *
                <input
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => change("price", event.target.value)}
                  required
                />
              </label>
              <label>
                Regular price (₹)
                <input
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  value={form.regularPrice}
                  onChange={(event) =>
                    change("regularPrice", event.target.value)
                  }
                />
              </label>
              <label>
                Stock *
                <input
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  value={form.stock}
                  onChange={(event) => change("stock", event.target.value)}
                  required
                />
              </label>
              <label>
                Status
                <select
                  value={String(form.isListed)}
                  onChange={(event) =>
                    change("isListed", event.target.value === "true")
                  }
                >
                  <option value="true">Listed</option>
                  <option value="false">Unlisted</option>
                </select>
              </label>
            </div>
          </fieldset>
          <div className="catalog-actions">
            <button
              className="cm-button"
              type="button"
              disabled={busy}
              onClick={() => setEditing(null)}
            >
              Cancel
            </button>
            <button className="catalog-primary" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save variant"}
            </button>
          </div>
        </form>
      )}
      <div className="cm-table-card">
        <div className="cm-table-scroll">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Variant</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th className="cm-actions-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td>
                    {variant.name}
                    {product.defaultVariantId === variant.id && (
                      <span className="catalog-default-badge">Default</span>
                    )}
                    {variant.options?.length > 0 && (
                      <small className="catalog-variant-caption">
                        {variant.options
                          .map((option) => `${option.name}: ${option.value}`)
                          .join(" · ")}
                      </small>
                    )}
                  </td>
                  <td>₹{(variant.pricePaise / 100).toLocaleString("en-IN")}</td>
                  <td>{variant.stock}</td>
                  <td>
                    <span
                      className={`cm-status ${variant.isListed ? "is-active" : "catalog-unlisted"}`}
                    >
                      {variant.isListed ? "Listed" : "Unlisted"}
                    </span>
                  </td>
                  <td>
                    <div className="catalog-row-actions">
                      <button
                        className="cm-button"
                        type="button"
                        disabled={busy || Boolean(editing)}
                        onClick={() => edit(variant)}
                      >
                        Edit
                      </button>
                      <button
                        className="cm-button cm-delete"
                        type="button"
                        disabled={busy || Boolean(editing)}
                        onClick={() => {
                          setDeleting(variant);
                          setError("");
                        }}
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
        {!product.variants.length && (
          <p className="cm-empty">
            No variants yet. This product currently uses its single-product
            price and stock.
          </p>
        )}
      </div>
      {deleting && (
        <ConfirmAction
          title="Delete variant permanently?"
          description={`“${deleting.name}” will be removed. If it is the last variant, product stock will be zero until you update it.`}
          busy={busy}
          error={error}
          danger
          onConfirm={remove}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}
