import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNavigation } from "./MobileNavigation";
import { SubscriptionAccessProvider } from "../../features/subscriptions/SubscriptionAccessContext";
import "./AppLayout.css";

export function AppLayout() {
  return (
    <SubscriptionAccessProvider>
      <div className="app-shell">
        <Sidebar />
        <MobileNavigation />

        <div className="app-shell__main">
          <Topbar />

          <main className="app-shell__content">
            <Outlet />
          </main>
        </div>
      </div>
    </SubscriptionAccessProvider>
  );
}
