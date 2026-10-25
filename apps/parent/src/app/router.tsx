import { Navigate, Route, Routes } from "react-router-dom";
import { useApp } from "./store";
import { Layout } from "../components/Layout";
import { AuthPage } from "../features/authentication/AuthPage";
import { FamilyPage } from "../features/family/FamilyPage";
import { DevicesPage } from "../features/devices/DevicesPage";
import { WebsiteRulesPage } from "../features/website-rules/WebsiteRulesPage";
import { ScreenTimePage } from "../features/screen-time/ScreenTimePage";
import { AppRestrictionsPage } from "../features/app-restrictions/AppRestrictionsPage";
import { RequestsPage } from "../features/reports/RequestsPage";
import { ReportsPage } from "../features/reports/ReportsPage";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useApp();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/family" replace />} />
        <Route path="/family" element={<FamilyPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/website-rules" element={<WebsiteRulesPage />} />
        <Route path="/screen-time" element={<ScreenTimePage />} />
        <Route path="/apps" element={<AppRestrictionsPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="*" element={<Navigate to="/family" replace />} />
      </Route>
    </Routes>
  );
}
