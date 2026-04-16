import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "240px 1fr",
        minHeight: "100vh",
      }}
    >
      <Sidebar />

      <div style={{ padding: 24 }}>
        <Topbar />
        <Outlet />
      </div>
    </div>
  );
}