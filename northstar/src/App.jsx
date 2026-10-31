import { BrowserRouter, Navigate, Routes, Route } from "react-router";
import Home from "./components/home.jsx";
import AdminLayout from "./admin/AdminLayout";
import AdminDashboard from "./admin/AdminDashboard";
import Categories from "./admin/categories.jsx";
import Customers from "./admin/Customers.jsx";
import AuthProvider from "./context/AuthProvider.jsx";
import RequireAdmin from "./components/RequireAdmin.jsx";
import RequireSignedIn from "./components/RequireSignedIn.jsx";
import StoreLayout from "./components/StoreLayout.jsx";
import ProfileScreen from "./components/profile/ProfileScreen.jsx";
import Addresses from "./pages/Addresses.jsx";
import Products from "./admin/products.jsx";
import ProductForm from "./admin/catalog/ProductForm.jsx";
import AdminProductReviews from "./admin/catalog/ProductReviews.jsx";
import ProductVariants from "./admin/catalog/ProductVariants.jsx";
import ShoppingProvider from "./context/ShoppingProvider.jsx";
import ProductListing from "./pages/ProductListing.jsx";
import ProductDetails from "./pages/ProductDetails.jsx";
import Cart from "./pages/Cart.jsx";
import Wishlist from "./pages/Wishlist.jsx";
import CheckoutReview from "./pages/CheckoutReview.jsx";
import NotFound from "./pages/NotFound.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ShoppingProvider>
          <Routes>
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<ProductListing />} />
              <Route path="/products/:id" element={<ProductDetails />} />
              <Route element={<RequireSignedIn />}>
                <Route path="/cart" element={<Cart />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/checkout" element={<CheckoutReview />} />
                <Route path="/addresses" element={<Addresses />} />
                <Route path="/profile" element={<ProfileScreen key="view" />} />
                <Route
                  path="/profile/edit"
                  element={<ProfileScreen key="edit" editing />}
                />
              </Route>
            </Route>
            <Route
              path="/login"
              element={<Navigate to="/?signin=1" replace />}
            />
            <Route
              path="/register"
              element={<Navigate to="/?signup=1" replace />}
            />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="customers" element={<Customers />} />
                <Route path="categories" element={<Categories />} />
                <Route path="products" element={<Products />} />
                <Route
                  path="products/new"
                  element={<ProductForm key="new-product" />}
                />
                <Route
                  path="products/:id/edit"
                  element={<ProductForm key="edit-product" />}
                />
                <Route
                  path="products/:id/reviews"
                  element={<AdminProductReviews />}
                />
                <Route
                  path="products/:id/variants"
                  element={<ProductVariants />}
                />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ShoppingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
