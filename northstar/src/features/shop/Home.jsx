import { useEffect, useState } from "react";
import CategoryBar from "../../components/layout/CategoryBar.jsx";
import ShopProductCard from "./ShopProductCard.jsx";
import API from "../../api/API.js";
import PromoBanners from "./PromoBanners.jsx";
import StoreBenefits from "../../components/layout/StoreBenefits.jsx";
import NewArrivals from "./NewArrivals.jsx";
import FAQ from "./FAQ.jsx";
import { Link, useLocation } from "react-router";
function Home() {
  const { hash, key: locationKey } = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function loadShoppingData() {
      try {
        const [resultResponse, optionsResponse] = await Promise.all([
          API.get("/products", {
            signal: controller.signal,
            params: {
              limit: 4,
            },
          }),
          API.get("/products/categories", {
            signal: controller.signal,
          }),
        ]);
        const result = resultResponse.data.data;
        const options = optionsResponse.data.data;
        if (!controller.signal.aborted) {
          setProducts(result.products);
          setCategories(options.categories);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setError(error.message);
        }
      }
    }
    loadShoppingData();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, [hash, locationKey]);
  function categoryLink(pattern) {
    const category =
      categories.find(
        (category) => !category.parentId && pattern.test(category.name),
      ) || categories.find((category) => pattern.test(category.name));
    return category ? `/products?category=${category.id}` : null;
  }
  const laptopLink = categoryLink(/^laptops?$/i);
  const mobileLink = categoryLink(/^(mobiles?|smartphones?|phones?)$/i);
  const audioLink = categoryLink(/audio|headphone/i);
  return (
    <main>
      <section className="hero">
        <div className="hero-content">
          <p>Latest tech. Better living.</p>

          <h1>Power Meets Performance</h1>

          <p className="hero-description">
            Explore the latest laptops, smartphones, and accessories from top
            brands. Built for work, play, and everything in between.
          </p>

          <div className="hero-actions">
            <Link className="shop-button" to="/products">
              Shop Now →
            </Link>

            <Link
              className="explore-link"
              to={laptopLink || "#"}
              aria-disabled={!laptopLink}
              onClick={(event) => {
                if (!laptopLink) {
                  event.preventDefault();
                }
              }}
            >
              Explore Laptops →
            </Link>
          </div>
        </div>

        <img
          className="hero-image"
          src="/hero.png"
          alt="Laptops and headphones on a desk"
        />
      </section>

      <CategoryBar categories={categories} />

      <section className="best-sellers" id="best-sellers">
        <div className="section-heading">
          <div>
            <p className="section-label">Featured products</p>
            <h2>Explore Our Collection</h2>
          </div>
          <a href="/products">View All →</a>
        </div>
        {error && (
          <p role="alert" className="shop-error">
            {error} <Link to="/products">Browse products</Link>
          </p>
        )}
        <div className="shop-grid">
          {products.map((product) => (
            <ShopProductCard key={product.id} product={product} />
          ))}
        </div>
        {!error && !products.length && (
          <p className="shop-help">New products are coming soon.</p>
        )}
      </section>

      <PromoBanners mobileLink={mobileLink} audioLink={audioLink} />
      <StoreBenefits />
      <NewArrivals products={products.slice(0, 4)} />
      <FAQ />
    </main>
  );
}
export default Home;
