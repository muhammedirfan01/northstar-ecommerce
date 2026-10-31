import { useEffect, useRef, useState } from "react";
import { categoryApi } from "../../api/catalog.js";
import ImageUploader from "./ImageUploader.jsx";

export default function CategoryForm({ category, onClose, onSaved }) {
  const ref = useRef(null);
  const [name, setName] = useState(category?.name || "");
  const [parentId, setParentId] = useState(category?.parentId || "");
  const [categories, setCategories] = useState([]);
  const [optionsError, setOptionsError] = useState("");
  const [isListed, setListed] = useState(category?.isListed ?? true);
  const [images, setImages] = useState(category?.image ? [category.image] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current.showModal();
    const controller = new AbortController();
    categoryApi
      .list({ options: true }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCategories(result.categories);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setOptionsError(error.message);
      });
    return () => controller.abort();
  }, []);

  async function save(event) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter a category name with at least 2 characters.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set(
      "data",
      JSON.stringify({
        name: name.trim(),
        parentId,
        isListed,
        keepImage: Boolean(images[0]?.id),
      }),
    );
    if (images[0]?.file) form.append("images", images[0].file);
    try {
      await categoryApi.save(category?.id, form);
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="cm-dialog catalog-dialog catalog-category-form"
      aria-labelledby="category-form-title"
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <h2 id="category-form-title">
        {category ? "Edit category" : "Add category"}
      </h2>
      <p>
        Organise products into a category. Unlisting hides its products from
        customers.
      </p>
      <form onSubmit={save}>
        <fieldset className="catalog-fields" disabled={busy}>
          <label>
            Category name <span aria-hidden="true">*</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
              autoFocus
            />
          </label>
          <label>
            Parent category
            <select
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
              disabled={Boolean(optionsError)}
            >
              <option value="">None — main category</option>
              {categories
                .filter((item) => !item.parentId && item.id !== category?.id)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {!item.isListed ? " (unlisted)" : ""}
                  </option>
                ))}
            </select>
          </label>
          {optionsError && <p className="cm-error">{optionsError}</p>}
          <p className="catalog-help">
            Choose a parent to create a subcategory, for example Laptops →
            Gaming Laptops. One subcategory level is supported.
          </p>
          <div>
            <span className="catalog-label">Category image (optional)</span>
            <ImageUploader
              max={1}
              images={images}
              onChange={setImages}
              disabled={busy}
            />
          </div>
          <label>
            Status
            <select
              value={String(isListed)}
              onChange={(event) => setListed(event.target.value === "true")}
            >
              <option value="true">Listed</option>
              <option value="false">Unlisted</option>
            </select>
          </label>
        </fieldset>
        {error && (
          <p className="cm-error" role="alert">
            {error}
          </p>
        )}
        <div className="catalog-actions">
          <button
            className="cm-button"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="catalog-primary"
            type="submit"
            disabled={busy || Boolean(optionsError)}
          >
            {busy ? "Saving…" : "Save category"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
