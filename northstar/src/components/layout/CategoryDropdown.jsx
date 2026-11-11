import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export default function CategoryDropdown({ categories = [], active = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdown = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    function outside(event) {
      if (!dropdown.current?.contains(event.target)) setIsOpen(false);
    }
    function escape(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape);
    };
  }, [isOpen]);

  // Get main categories
  const mainCategories = categories.filter((category) => !category.parentId);

  return (
    <div
      className="category-dropdown"
      ref={dropdown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setIsOpen(false);
      }}
    >
      <button
        className="category-trigger"
        aria-current={active ? "page" : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        Categories ▾
      </button>

      {isOpen && (
        <div className="category-dropdown-panel">
          {mainCategories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.id}`}
              className="category-option"
              onClick={() => setIsOpen(false)}
            >
              {category.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
