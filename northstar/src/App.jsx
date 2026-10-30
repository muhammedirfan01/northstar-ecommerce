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
import Products from "./admin/products.jsx"

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route element={<RequireSignedIn />}>
              <Route path="/addresses" element={<Addresses />} />
              <Route path="/profile" element={<ProfileScreen key="view" />} />
              <Route path="/profile/edit" element={<ProfileScreen key="edit" editing />} />
            </Route>
          </Route>
          <Route path="/login" element={<Navigate to="/?signin=1" replace />} />
          <Route path="/register" element={<Navigate to="/?signup=1" replace />} />
          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="customers" element={<Customers />} />
              <Route path="categories" element={<Categories/>} />
              <Route path="products" element={<Products/>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
