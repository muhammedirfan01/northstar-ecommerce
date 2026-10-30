import { useContext } from "react";
import { Link, NavLink, Outlet } from "react-router";
import {
  Compass,
  LayoutDashboard,
  Archive,
  Shapes,
  ShoppingBag,
  Users,
  Warehouse,
  CreditCard,
  PackageX,
  Tag,
  BadgePercent,
  ChartNoAxesColumnIncreasing,
  Settings2,
  LogOut,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext.js";
import ProfileAvatar from "../components/ProfileAvatar.jsx";
import "./admin.css";
const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  {label:"Products",icon:Archive,path: "/admin/products" },
  {label:"Categories",icon: Shapes,path:"/admin/categories"},
  {label:"Orders",icon: ShoppingBag,path: "/admin/customers" },
  {label:"Customers",icon: Users,path: "/admin/customers" },
  {label:"Inventory",icon: Warehouse,path: "/admin/customers" },
];
const salesNavigation =[
  {label:"Payments", icon: CreditCard, path: "/admin/customers"},
  {label:"Returns & Refunds",icon: PackageX, path: "/admin/customers" },
  {label:"Coupons",icon: Tag, path: "/admin/customers" },
  {label:"Offers and Campaigns",icon: BadgePercent, path: "/admin/customers" },
  {label:"Sales Report",icon: ChartNoAxesColumnIncreasing, path: "/admin/customers" },
]
const system=[
  {label:"Settings",icon:Settings2,path:"/admin/customers"}
]
const navigationSystems=[
  {title:"Main",items:navigation},
  {title:"Sales and Marketing",items:salesNavigation},
  {title:"System",items:system}
]
export default function AdminLayout() {
  const { user, requestLogout } = useContext(AuthContext);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-brand">
          <Compass size={25} aria-hidden="true" />
          <span><strong>NORTHSTAR</strong><small>ADMIN PANEL</small></span>
        </Link>
        <nav className="admin-navigation" aria-label="Admin navigation">
          {navigationSystems.map((sections)=>(
          <div  className="admin-navigation-section" key={sections.title}>
              <h4 className="admin-navigation-label">{sections.title}</h4>
              <div  className="admin-navigation-links">
                {sections.items.map(({label,icon:Icon,path})=>{
                  return(
                  <NavLink 
                    key={label}
                  to={path}
                  end
                 className={({isActive})=>isActive?"admin-nav-item is-active":"admin-nav-item"}
                  >
                    <Icon size={19} strokeWidth={1.9} aria-hidden="true"></Icon>
                     <span>{label}</span>
                  </NavLink>
                  )
                 })}
                </div>             
              </div>
          ))}
        </nav>
        <div className="admin-account">
          <span className="admin-account-avatar"><ProfileAvatar user={user} /></span>
          <div><strong>{user.name}</strong><small>{user.email}</small></div>
          <button className="admin-logout" type="button" onClick={requestLogout} aria-label="Sign out" aria-haspopup="dialog"><LogOut size={20} aria-hidden="true" /></button>
        </div>
      </aside>
      <div className="admin-workspace">
        <main className="admin-content"><Outlet /></main>
      </div>
    </div>
  );
}
