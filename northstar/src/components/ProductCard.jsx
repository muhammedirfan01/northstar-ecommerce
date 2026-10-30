export default function ProductCard({
  name,
  description,
  price,
  image,
  onView,
}) {
  return (
    <article className="product-card">
      <img
        className="product-image"
        src={image}
        alt={name}
        loading="lazy"
      />

      <h3 className="product-name">{name}</h3>
      <p className="product-price">{price}</p>

      <details
        className="product-details"
        onToggle={(event) => {
          if (event.currentTarget.open) {
            onView?.();
          }
        }}
      >
        <summary>View details</summary>
        <p className="product-description">{description}</p>
      </details>
    </article>
  );
}