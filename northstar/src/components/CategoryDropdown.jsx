import { useRef, useState } from "react";
import { Link } from "react-router";

export default function CategoryDropdown({ categories = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);
  const ordered = categories
    .filter((category) => !category.parentId)
    .flatMap((parent) => [
      parent,
      ...categories.filter((category) => category.parentId === parent.id),
    ]);
  return (
    <div
      className="category-dropdown"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        className="category-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-controls="header-categories"
        onClick={() => setIsOpen(!isOpen)}
      >
        Categories <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="category-dropdown-panel" id="header-categories">
          <Link
            className="category-option"
            to="/products"
            onClick={() => setIsOpen(false)}
          >
            All products
          </Link>
          {ordered.map((category) => (
            <Link
              className={
                category.parentId
                  ? "category-option category-suboption"
                  : "category-option"
              }
              to={`/products?category=${category.id}`}
              key={category.id}
              onClick={() => setIsOpen(false)}
            >
              {category.parentId ? `↳ ${category.name}` : category.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
