import { optionKey, variantOptions } from "../../utils/variants.js";

export default function ProductVariantOptions({ variants, value, onChange }) {
  const selected = variants.find((variant) => variant.id === value);
  const names = [];
  for (const variant of variants)
    for (const option of variantOptions(variant)) {
      if (!names.some((name) => optionKey(name) === optionKey(option.name)))
        names.push(option.name);
    }
  function optionValue(variant, name) {
    return (
      variantOptions(variant).find(
        (option) => optionKey(option.name) === optionKey(name),
      )?.value || "Standard"
    );
  }
  if (
    !names.length ||
    variants.some((variant) => !variantOptions(variant).length)
  )
    return (
      <fieldset className="pd-option-fieldset">
        <legend>Variant</legend>
        <div className="pd-configurations">
          {variants.map((variant) => (
            <button
              type="button"
              key={variant.id}
              disabled={!variant.stock}
              aria-pressed={value === variant.id}
              onClick={() => onChange(variant.id)}
            >
              {variant.name}
              {!variant.stock ? " — Out of stock" : ""}
            </button>
          ))}
        </div>
      </fieldset>
    );
  return (
    <div className="pd-variant-options">
      {names.map((name, index) => {
        const values = [
          ...new Set(variants.map((variant) => optionValue(variant, name))),
        ];
        return (
          <fieldset className="pd-option-fieldset" key={name}>
            <legend>
              {name}:{" "}
              <strong>
                {selected ? optionValue(selected, name) : "Select"}
              </strong>
            </legend>
            <div className="pd-option-values">
              {values.map((option) => {
                const matching = variants.filter(
                  (variant) =>
                    optionValue(variant, name) === option &&
                    names
                      .slice(0, index)
                      .every(
                        (previous) =>
                          optionValue(variant, previous) ===
                          optionValue(selected, previous),
                      ),
                );
                const available = matching.filter(
                  (variant) => variant.stock > 0 && variant.isListed,
                );
                function choose() {
                  // Keep later choices where possible; otherwise use the next available combination.
                  const exact = available.find((variant) =>
                    names
                      .slice(index + 1)
                      .every(
                        (next) =>
                          optionValue(variant, next) ===
                          optionValue(selected, next),
                      ),
                  );
                  onChange((exact || available[0]).id);
                }
                const swatch =
                  optionKey(name) === "colour" ? matching[0]?.colorHex : null;
                return (
                  <button
                    type="button"
                    key={option}
                    disabled={!available.length}
                    aria-pressed={
                      selected && optionValue(selected, name) === option
                    }
                    onClick={choose}
                  >
                    {swatch && (
                      <span
                        className="pd-colour-dot"
                        style={{ background: swatch }}
                      />
                    )}
                    {option}
                    {!available.length && <small>Unavailable</small>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
