import { useRef, useState } from "react";
const ranges = [
  {
    label: "Any price",
    min: "",
    max: "",
  },
  {
    label: "Under ₹5,000",
    min: "",
    max: "5000",
  },
  {
    label: "₹5,000 – ₹25,000",
    min: "5000",
    max: "25000",
  },
  {
    label: "₹25,000 – ₹50,000",
    min: "25000",
    max: "50000",
  },
  {
    label: "₹50,000 – ₹1,00,000",
    min: "50000",
    max: "100000",
  },
  {
    label: "Over ₹1,00,000",
    min: "100000",
    max: "",
  },
];
export default function ProductFilters({ params, categories, onApply }) {
  const selected = categories.find((item) => item.id === params.get("category"));
  const [category, setCategory] = useState(selected?.parentId || params.get("category") || "");
  const [subcategory, setSubcategory] = useState(params.get("subcategory") || (selected?.parentId ? selected.id : ""));
  const [search, setSearch] = useState(params.get("search") || "");
  const [sort, setSort] = useState(params.get("sort") || "latest");
  const children = categories.filter((item) => category && item.parentId === category);
  const [minimum, setMinimum] = useState(params.get("minPrice") || "");
  const [maximum, setMaximum] = useState(params.get("maxPrice") || "");
  const [priceOpen, setPriceOpen] = useState(false);
  const [error, setError] = useState("");
  const priceButton = useRef(null);
  const range = ranges.findIndex(
    (range) => range.min === minimum && range.max === maximum,
  );
  let priceLabel;
  if (range >= 0) {
    priceLabel = ranges[range].label;
  } else {
    priceLabel = "Custom price";
  }
  function apply(event) {
    event.preventDefault();
    if (
      [minimum, maximum]
        .filter((value) => value !== "")
        .some(
          (value) =>
            !Number.isSafeInteger(Number(value)) ||
            Number(value) < 0 ||
            Number(value) > 99999999,
        )
    ) {
      setError("Enter whole rupee amounts between 0 and 9,99,99,999.");
      setPriceOpen(true);
      return;
    }
    if (minimum && maximum && Number(minimum) > Number(maximum)) {
      setError("Minimum price must not exceed maximum price.");
      setPriceOpen(true);
      return;
    }
    setError("");
    setPriceOpen(false);
    const next = new URLSearchParams();
    for (const [name, value] of new FormData(event.currentTarget)) {
      if (value.trim()) {
        next.set(name, value.trim());
      }
    }
    onApply(next);
  }
  function clear() {
    setSearch("");
    setSort("latest");
    setCategory("");
    setSubcategory("");
    setMinimum("");
    setMaximum("");
    setError("");
    setPriceOpen(false);
    const next = new URLSearchParams();
    onApply(next);
  }
  return (
    <form
      className={`shop-filters shop-filter-bar${children.length ? " has-subcategories" : ""}`}
      aria-label="Product filters"
      onSubmit={apply}
    >
      <label className="shop-filter-search">
        Search
        <input
          name="search"
          type="search"
          maxLength={100}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products..."
        />
      </label>
      <label className="shop-filter-category">
        Category
        <select
          name="category"
          value={category}
          onChange={(event) => { setCategory(event.target.value); setSubcategory(""); }}
        >
          <option value="">All categories</option>
          {categories.filter((item) => !item.parentId).map((category) => (
            <option value={category.id} key={category.id}>
              {category.parentName
                ? `${category.parentName} › ${category.name}`
                : category.name}
            </option>
          ))}
        </select>
      </label>
      {children.length > 0 && (
      <label className="shop-filter-subcategory">
        Subcategory
        <select name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>
          <option value="">All subcategories</option>
          {children.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      )}
      <input type="hidden" name="minPrice" value={minimum} />
      <input type="hidden" name="maxPrice" value={maximum} />
      <div
        className="shop-price-filter"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setPriceOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setPriceOpen(false);
            priceButton.current.focus();
          }
        }}
      >
        <span className="shop-filter-label">Price</span>
        <button
          ref={priceButton}
          className="shop-price-trigger"
          type="button"
          aria-label={`Price: ${priceLabel}`}
          aria-expanded={priceOpen}
          aria-controls="price-options"
          onClick={() => setPriceOpen(!priceOpen)}
        >
          {priceLabel}
          <span aria-hidden="true">⌄</span>
        </button>
        {priceOpen && (
          <div className="shop-price-panel" id="price-options">
            <label>
              Price range
              <select
                aria-label="Preset price range"
                value={range < 0 ? "custom" : String(range)}
                onChange={(event) => {
                  const selected = ranges[Number(event.target.value)];
                  if (selected) {
                    setMinimum(selected.min);
                    setMaximum(selected.max);
                  }
                }}
              >
                <option value="custom" disabled>
                  Custom range
                </option>
                {ranges.map((range, index) => (
                  <option key={range.label} value={index}>
                    {range.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="shop-price-inputs">
              <label>
                Minimum (₹)
                <input
                  aria-label="Minimum price in rupees"
                  type="number"
                  min="0"
                  max="99999999"
                  step="1"
                  placeholder="Min"
                  value={minimum}
                  onChange={(event) => setMinimum(event.target.value)}
                />
              </label>
              <span>–</span>
              <label>
                Maximum (₹)
                <input
                  aria-label="Maximum price in rupees"
                  type="number"
                  min="0"
                  max="99999999"
                  step="1"
                  placeholder="Max"
                  value={maximum}
                  onChange={(event) => setMaximum(event.target.value)}
                />
              </label>
            </div>
            <p className="shop-help">Enter prices in rupees.</p>
            <button
              type="button"
              className="shop-secondary"
              onClick={() => {
                setPriceOpen(false);
                priceButton.current.focus();
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
      <label className="shop-filter-sort">
        Sort by
        <select name="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
          <option value="latest">Latest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="name-asc">Name: A–Z</option>
          <option value="name-desc">Name: Z–A</option>
        </select>
      </label>
      <button className="shop-primary shop-filter-apply" type="submit">
        Apply
      </button>
      <button className="shop-filter-clear" type="button" onClick={clear}>
        Clear
      </button>
      {error && (
        <p className="shop-error shop-filter-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
