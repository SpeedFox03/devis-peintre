import { NavLink } from "react-router-dom";

const linkStyle = ({ isActive }: { isActive: boolean }) => ({
  display: "block",
  padding: "10px 12px",
  borderRadius: 10,
  textDecoration: "none",
  color: "#111827",
  background: isActive ? "#eef2ff" : "transparent",
  fontWeight: isActive ? 600 : 400,
});

export function Sidebar() {
  return (
    <aside
      style={{
        borderRight: "1px solid #e5e7eb",
        padding: 16,
        minHeight: "100vh",
      }}
    >
      <h2 style={{ marginTop: 0 }}>Devis Peintre</h2>

      <nav style={{ display: "grid", gap: 8, marginTop: 24 }}>
        <NavLink to="/" end style={linkStyle}>
          Devis
        </NavLink>

        <NavLink to="/clients" style={linkStyle}>
          Clients
        </NavLink>

        <NavLink to="/catalogue" style={linkStyle}>
          Catalogue
        </NavLink>

        <NavLink to="/factures" style={linkStyle}>
          Factures
        </NavLink>

        <NavLink to="/parametres" style={linkStyle}>
          Paramètres
        </NavLink>
      </nav>
    </aside>
  );
}