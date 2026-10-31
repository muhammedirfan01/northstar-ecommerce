export default function ProductPresentationFields({ form, change }) {
  function updateSpec(index, field, value) {
    change(
      "quickSpecs",
      form.quickSpecs.map((spec, position) =>
        position === index ? { ...spec, [field]: value } : spec,
      ),
    );
  }
  return (
    <section className="catalog-card">
      <h2>Product page appearance</h2>
      <p className="catalog-help">
        Optional details shown on the customer product page.
      </p>
      <div className="catalog-form-grid">
        <label>
          Series or collection
          <input
            value={form.series}
            maxLength={80}
            placeholder="Apple flagship pro series"
            onChange={(event) => change("series", event.target.value)}
          />
        </label>
        <label>
          Product badge
          <select
            value={form.badge}
            onChange={(event) => change("badge", event.target.value)}
          >
            <option value="">No badge</option>
            {[
              "Best seller",
              "Deal of the day",
              "Most purchased",
              "New arrival",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="catalog-wide">
          Short summary
          <input
            value={form.subtitle}
            maxLength={240}
            placeholder="Apple M3 Pro Chip • 36GB Unified Memory • 512GB SSD"
            onChange={(event) => change("subtitle", event.target.value)}
          />
        </label>
        <label className="catalog-wide">
          Note below the price
          <input
            value={form.priceNote}
            maxLength={180}
            placeholder="Inclusive of all taxes. Includes a one-year manufacturer warranty."
            onChange={(event) => change("priceNote", event.target.value)}
          />
        </label>
      </div>
      <div className="catalog-card-heading">
        <h3>Quick specification cards</h3>
        <button
          type="button"
          className="cm-button"
          disabled={form.quickSpecs.length >= 6}
          onClick={() =>
            change("quickSpecs", [
              ...form.quickSpecs,
              { label: "", value: "", note: "" },
            ])
          }
        >
          + Add specification card
        </button>
      </div>
      <p className="catalog-help">
        Add up to six cards, such as Display, Processor, Memory, Battery and
        Weight.
      </p>
      {form.quickSpecs.map((spec, index) => (
        <div className="catalog-quick-spec" key={index}>
          <label>
            Label *
            <input
              value={spec.label}
              required
              maxLength={60}
              placeholder="Display"
              onChange={(event) =>
                updateSpec(index, "label", event.target.value)
              }
            />
          </label>
          <label>
            Value *
            <input
              value={spec.value}
              required
              maxLength={120}
              placeholder={"16.2-inch Liquid Retina XDR"}
              onChange={(event) =>
                updateSpec(index, "value", event.target.value)
              }
            />
          </label>
          <label>
            Extra detail
            <input
              value={spec.note}
              maxLength={200}
              placeholder="120Hz ProMotion"
              onChange={(event) =>
                updateSpec(index, "note", event.target.value)
              }
            />
          </label>
          <button
            type="button"
            className="cm-button cm-delete"
            aria-label={`Remove specification card ${index + 1}`}
            onClick={() =>
              change(
                "quickSpecs",
                form.quickSpecs.filter((_, position) => position !== index),
              )
            }
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
