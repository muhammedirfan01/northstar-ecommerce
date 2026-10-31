export default function VariantOptionFields({ options, onChange }) {
  function change(index, field, value) {
    onChange(
      options.map((option, position) =>
        position === index ? { ...option, [field]: value } : option,
      ),
    );
  }
  return (
    <section className="catalog-wide">
      <div className="catalog-card-heading">
        <h3>Variant options</h3>
        <button
          className="cm-button"
          type="button"
          disabled={options.length >= 5}
          onClick={() => onChange([...options, { name: "", value: "" }])}
        >
          + Add option
        </button>
      </div>
      <p className="catalog-help">
        Use any option name: Colour, RAM, Storage, Size, Processor or Capacity.
        Add one variant for each combination you sell.
      </p>
      <datalist id="variant-option-names">
        {["Colour", "RAM", "Storage", "Size", "Processor", "Capacity"].map(
          (name) => (
            <option key={name} value={name} />
          ),
        )}
      </datalist>
      {options.map((option, index) => (
        <div className="catalog-option-row" key={index}>
          <label>
            Option name
            <input
              list="variant-option-names"
              value={option.name}
              maxLength={40}
              required={Boolean(option.value)}
              placeholder="Colour"
              onChange={(event) => change(index, "name", event.target.value)}
            />
          </label>
          <label>
            Option value
            <input
              value={option.value}
              maxLength={80}
              required={Boolean(option.name)}
              placeholder="Burgundy"
              onChange={(event) => change(index, "value", event.target.value)}
            />
          </label>
          <button
            className="cm-button cm-delete"
            type="button"
            onClick={() =>
              onChange(options.filter((_, position) => position !== index))
            }
          >
            Remove option
          </button>
        </div>
      ))}
    </section>
  );
}
