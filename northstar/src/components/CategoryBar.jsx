import { Link } from "react-router";

export default function CategoryBar({ categories = [] }) {
  return (
    <nav className="category-bar" aria-label="Product categories">
      {categories
        .filter((category) => !category.parentId)
        .slice(0, 8)
        .map((category) => (
          <Link
            className="category-link"
            to={`/products?category=${category.id}`}
            key={category.id}
          >
            <img
              className="category-icon"
              src={category.image?.url || "/accessories_icon.png"}
              alt=""
            />
            <span>{category.name}</span>
          </Link>
        ))}
    </nav>
  );
}
