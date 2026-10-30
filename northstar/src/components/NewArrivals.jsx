import ProductCard from "./ProductCard.jsx";

export default function NewArrivals({ products, onView }){
  return (
    <section className="new-arrivals">
      <div className="section-heading">
        <h2>New Arrivals &amp; Innovations</h2>

        <a href="#">View All →</a>
      </div>

      <div className="product-grid arrivals-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            name={product.name}
            description={product.description}
            price={product.price}
            image={product.image}
             onView={() => onView(product.id)}
          />
        ))}
      </div>
    </section>
  );
}