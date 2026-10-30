import { useRef, useState } from "react";

const categories = [
  "Laptops",
  "Mobiles",
  "Audio",
  "Smartwatches",
  "Gaming",
  "Cameras",
  "TV & Home Theatre",
  "Accessories",
];

export default function CategoryDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef(null);

  function handleKeyDown(event) {
    if (event.key === "Escape" && isOpen) {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  }

  function handleBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsOpen(false);
    }
  }

  return (
    <div
      className="category-dropdown"
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
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
        <div
          className="category-dropdown-panel"
          id="header-categories"
        >
          {categories.map((category) => (
            <a
              className="category-option"
              href="#"
              key={category}
              onClick={() => setIsOpen(false)}
            >
              {category}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}