import { useState } from "react";
import { Link } from "react-router";

export default function CategoryDropdown({ categories = [] }) {
  const [isOpen, setIsOpen] = useState(false);

  // Get main categories
  const mainCategories = categories.filter(
    (category) => !category.parentId
  );

  // Arrange main categories and their subcategories
  const orderedCategories = [];

  mainCategories.forEach((parent) => {
    orderedCategories.push(parent);

    const subCategories = categories.filter(
      (category) => category.parentId === parent.id
    );

    orderedCategories.push(...subCategories);
  });

  return (
    <div className="category-dropdown">
      <button
        className="category-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        Categories ▾
      </button>

      {isOpen && (
        <div className="category-dropdown-panel">

          <Link
            className="category-option"
            to="/products"
            onClick={() => setIsOpen(false)}
          >
            All products
          </Link>

          {orderedCategories.map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.id}`}
              className={
                category.parentId
                  ? "category-option category-suboption"
                  : "category-option"
              }
              onClick={() => setIsOpen(false)}
            >
              {category.parentId ? "↳ " : ""}
              {category.name}
            </Link>
          ))}

        </div>
      )}
    </div>
  );
}