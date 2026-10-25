import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  AppWindow,
  Clock,
  Globe,
  Inbox,
  LogOut,
  ScrollText,
  Shield,
  Smartphone,
  Users,
} from "lucide-react";
import { useApp } from "../app/store";
import styles from "./Layout.module.css";

const NAV = [
  { to: "/family", label: "Family", icon: Users },
  { to: "/devices", label: "Devices", icon: Smartphone },
  { to: "/website-rules", label: "Website rules", icon: Globe },
  { to: "/screen-time", label: "Screen time", icon: Clock },
  { to: "/apps", label: "App restrictions", icon: AppWindow },
  { to: "/requests", label: "Access requests", icon: Inbox },
  { to: "/reports", label: "Reports & audit", icon: ScrollText },
];

export function Layout() {
  const { user, logout } = useApp();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Shield size={18} />
          </span>
          <div>
            <p className={styles.brandName}>EntroGuard</p>
            <p className={styles.brandSub}>Parent dashboard</p>
          </div>
        </div>
        <nav className={styles.nav}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userBox}>
            <p className={styles.userEmail}>{user?.email}</p>
            <p className={styles.userRole}>Guardian account</p>
          </div>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
