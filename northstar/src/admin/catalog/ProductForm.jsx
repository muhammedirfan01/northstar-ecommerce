import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { categoryApi, productApi } from "../../api/catalog.js";
import ProductPresentationFields from "./ProductPresentationFields.jsx";
import ImageUploader from "./ImageUploader.jsx";
import "../customers.css";
import "./catalog.css";

const empty = {
  series: "",
  subtitle: "",
  badge: "",
  priceNote: "",
  quickSpecs: [],
  name: "",
  description: "",
  categoryId: "",
  price: "",
  regularPrice: "",
  stock: "0",
  isPublished: false,
  isListed: true,
  highlights: "",
  specifications: "",
};
export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [images, setImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [hasVariants, setHasVariants] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const options = await categoryApi.list(
          { options: true },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setCategories(options.categories);
        if (id) {
          const { product } = await productApi.get(id, controller.signal);
          if (controller.signal.aborted) return;
          setForm({
            series: product.series || "",
            subtitle: product.subtitle || "",
            badge: product.badge || "",
            priceNote: product.priceNote || "",
            quickSpecs: product.quickSpecs || [],
            name: product.name,
            description: product.description,
            categoryId: product.category.id,
            price: String(product.pricePaise / 100),
            regularPrice: product.regularPricePaise
              ? String(product.regularPricePaise / 100)
              : "",
            stock: String(product.stock),
            isPublished: product.isPublished,
            isListed: product.isListed,
            highlights: product.highlights.join("\n"),
            specifications: product.specifications.join("\n"),
          });
          setImages(product.images);
          setHasVariants(product.variants.length > 0);
        }
        setLoadError("");
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [id, reload]);

  function change(name, value) {
    setForm({ ...form, [name]: value });
  }
  async function save(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (form.name.trim().length < 2 || form.description.trim().length < 10) {
      setError(
        "Enter a product name and a description with at least 10 characters.",
      );
      return;
    }
    if (!images.length) {
      setError("Add at least one product image.");
      return;
    }
    if (
      !hasVariants &&
      form.regularPrice &&
      Number(form.regularPrice) < Number(form.price)
    ) {
      setError("The regular price must be at least the selling price.");
      return;
    }
    const details = {
      ...form,
      highlights: form.highlights
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      specifications: form.specifications
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      retainedImageIds: images
        .filter((image) => image.id)
        .map((image) => image.id),
    };
    if (hasVariants) {
      delete details.price;
      delete details.regularPrice;
      delete details.stock;
    }
    const body = new FormData();
    body.set("data", JSON.stringify(details));
    images
      .filter((image) => image.file)
      .forEach((image) => body.append("images", image.file));
    setBusy(true);
    try {
      const { product } = await productApi.save(id, body);
      if (!id)
        navigate(`/admin/products/${product.id}/edit`, { replace: true });
      else {
        setImages(product.images);
        setNotice("Product saved.");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">Loading product form…</p>;
  if (loadError)
    return (
      <div className="cm-notice cm-error" role="alert">
        {loadError}
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setReload(reload + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  return (
    <section className="cm-page catalog-page">
      <Link className="catalog-back" to="/admin/products">
        ← Back to products
      </Link>
      <p className="cm-breadcrumb">
        Catalog / Products / {id ? "Edit" : "Add product"}
      </p>
      <div className="cm-heading">
        <div>
          <h1>{id ? "Edit Product" : "Add Product"}</h1>
          <p>
            Save the product, then add variants on its separate variants page if
            needed.
          </p>
        </div>
      </div>
      {!categories.length && (
        <p className="cm-notice">
          Add a category before creating a product.{" "}
          <Link to="/admin/categories">Go to categories</Link>
        </p>
      )}
      {notice && (
        <p className="cm-notice" role="status">
          {notice}
        </p>
      )}
      <form onSubmit={save}>
        <fieldset className="catalog-form-fieldset" disabled={busy}>
          <section className="catalog-card">
            <h2>1. Basic information</h2>
            <div className="catalog-form-grid">
              <label className="catalog-wide">
                Product name *
                <input
                  value={form.name}
                  onChange={(event) => change("name", event.target.value)}
                  minLength={2}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Category *
                <select
                  value={form.categoryId}
                  onChange={(event) => change("categoryId", event.target.value)}
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.parentName
                        ? `${category.parentName} → ${category.name}`
                        : category.name}
                      {!category.isListed ? " (unlisted)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Publication status
                <select
                  value={String(form.isPublished)}
                  onChange={(event) =>
                    change("isPublished", event.target.value === "true")
                  }
                >
                  <option value="false">Draft</option>
                  <option value="true">Published</option>
                </select>
              </label>
              <label className="catalog-wide">
                Description *
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) =>
                    change("description", event.target.value)
                  }
                  minLength={10}
                  maxLength={5000}
                  required
                />
              </label>
            </div>
          </section>
          <ProductPresentationFields form={form} change={change} />
          <section className="catalog-card">
            <h2>2. Product images</h2>
            <p>Add 1–6 images. The first image is used on product listings.</p>
            <ImageUploader
              images={images}
              onChange={setImages}
              disabled={busy}
            />
          </section>
          <section className="catalog-card">
            <div className="catalog-card-heading">
              <h2>3. Pricing and stock</h2>
              {id && (
                <Link
                  className="cm-button"
                  to={`/admin/products/${id}/variants`}
                >
                  Add / edit variants
                </Link>
              )}
            </div>
            {id && (
              <p className="catalog-help">
                <Link to={`/admin/products/${id}/reviews`}>
                  Manage customer reviews
                </Link>
              </p>
            )}
            {hasVariants ? (
              <p>
                Prices and stock are managed separately for each variant. Total
                stock is calculated from listed variants.
              </p>
            ) : (
              <div className="catalog-form-grid">
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
                  Stock quantity *
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
              </div>
            )}
          </section>
          <section className="catalog-card">
            <h2>4. Highlights and specifications</h2>
            <div className="catalog-form-grid">
              <label>
                Highlights
                <textarea
                  rows={5}
                  placeholder="One highlight per line"
                  value={form.highlights}
                  onChange={(event) => change("highlights", event.target.value)}
                  maxLength={4000}
                />
              </label>
              <label>
                Specifications
                <textarea
                  rows={5}
                  placeholder="One row per line, e.g. Ports: 3 Thunderbolt ports"
                  value={form.specifications}
                  onChange={(event) =>
                    change("specifications", event.target.value)
                  }
                  maxLength={10000}
                />
              </label>
            </div>
            <p>
              Use up to 20 lines. Highlights allow 200 characters per line.
              Detailed specifications allow 500 characters per line; use Label:
              Detail for table rows.
            </p>
          </section>
        </fieldset>
        {error && (
          <p className="cm-notice cm-error" role="alert">
            {error}
          </p>
        )}
        <div className="catalog-actions">
          <Link className="cm-button" to="/admin/products">
            Cancel
          </Link>
          <button
            className="catalog-primary"
            type="submit"
            disabled={busy || !categories.length}
          >
            {busy ? "Saving…" : id ? "Save changes" : "Save product"}
          </button>
        </div>
      </form>
    </section>
  );
}
