import { BrowserRouter, Navigate, Routes, Route } from "react-router";
import Home from "./features/shop/Home.jsx";
import AdminLayout from "./features/admin/AdminLayout.jsx";
import AdminDashboard from "./features/admin/AdminDashboard.jsx";
import Categories from "./features/admin/categories/Categories.jsx";
import Customers from "./features/admin/customers/Customers.jsx";
import AuthProvider from "./context/AuthProvider.jsx";
import RequireAdmin from "./features/admin/RequireAdmin.jsx";
import RequireSignedIn from "./features/auth/RequireSignedIn.jsx";
import StoreLayout from "./components/layout/StoreLayout.jsx";
import ProfileScreen from "./features/profile/ProfileScreen.jsx";
import Addresses from "./features/profile/Addresses.jsx";
import Products from "./features/admin/products/Products.jsx";
import ProductForm from "./features/admin/products/ProductForm.jsx";
import AdminProductReviews from "./features/admin/products/ProductReviews.jsx";
import ProductVariants from "./features/admin/products/ProductVariants.jsx";
import ShoppingProvider from "./context/ShoppingProvider.jsx";
import ProductListing from "./features/shop/ProductListing.jsx";
import ProductDetails from "./features/shop/ProductDetails.jsx";
import Cart from "./features/cart/Cart.jsx";
import Wishlist from "./features/wishlist/Wishlist.jsx";
import CheckoutReview from "./features/checkout/CheckoutReview.jsx";
import NotFound from "./components/ui/NotFound.jsx";
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
