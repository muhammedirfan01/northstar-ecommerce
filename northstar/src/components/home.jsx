import { useEffect } from "react";
import CategoryBar from "./CategoryBar.jsx";
import ProductCard from "./ProductCard.jsx";
import PromoBanners from "./PromoBanners.jsx";
import StoreBenefits from "./StoreBenefits.jsx";
import NewArrivals from "./NewArrivals.jsx";
import FAQ from "./FAQ.jsx";
import { useLocation } from "react-router";

const bestSellers = [
  {
    id: 1,
    name: "MacBook Air M2",
    description: "8GB RAM | 256GB SSD",
    price: "₹89,990",
    image: "/laptop.png",
  },
  {
    id: 2,
    name: "iPhone 15",
    description: "128GB | Black",
    price: "₹69,900",
    image: "/phone.png",
  },
  {
    id: 3,
    name: "AirPods Pro (2nd Gen)",
    description: "Active Noise Cancellation",
    price: "₹24,900",
    image: "/airpods.png",
  },
  {
    id: 4,
    name: "Apple Watch Series 9",
    description: "GPS | 45mm | Midnight",
    price: "₹41,900",
    image: "/watch.png",
  },
  {
    id: 5,
    name: "Sony Alpha 7 IV",
    description: "33MP | 4K Video",
    price: "₹1,59,990",
    image: "/camera.png",
  },
];

function Home() {
  const { hash, key: locationKey } = useLocation();

  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash, locationKey]);

  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p>Latest tech. Better living.</p>

          <h1>Power Meets Performance</h1>

          <p className="hero-description">
            Explore the latest laptops, smartphones, and accessories
            from top brands. Built for work, play, and everything
            in between.
          </p>

          <div className="hero-actions">
            <a className="shop-button" href="#">
              Shop Now →
            </a>

            <a className="explore-link" href="#">
              Explore Laptops →
            </a>
          </div>
        </div>

        <img
          className="hero-image"
          src="/hero.png"
          alt="Laptops and headphones on a desk"
        />
      </section>

      <CategoryBar />

      <section className="best-sellers" id="best-sellers">
        <div className="section-heading">
          <div>
            <p className="section-label">Featured products</p>
            <h2>Best Sellers</h2>
          </div>
          <a href="#">View All →</a>
        </div>
        <div className="product-grid">
          {bestSellers.map((product) => (
            <ProductCard
              key={product.id}
              name={product.name}
              description={product.description}
              price={product.price}
              image={product.image}
            />
          ))}
        </div>
      </section>

      <PromoBanners />
      <StoreBenefits />
      <NewArrivals products={bestSellers.slice(0, 4)} />
      <FAQ />
    </main>
  );
}

export default Home;