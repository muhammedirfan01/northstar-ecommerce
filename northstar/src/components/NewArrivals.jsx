import ShopProductCard from "./shop/ShopProductCard.jsx";

export default function NewArrivals({ products }) {
  return (
    <section className="new-arrivals">
      <div className="section-heading">
        <h2>New Arrivals &amp; Innovations</h2>

        <a href="/products">View All →</a>
      </div>

      <div className="product-grid arrivals-grid">
        {products.map((product) => (
          <ShopProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
