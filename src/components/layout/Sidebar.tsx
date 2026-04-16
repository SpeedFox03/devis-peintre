import { NavLink } from "react-router-dom";
import "./Sidebar.css";

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
  return `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`.trim();
}

export function Sidebar() {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-mark">DP</div>

        <div>
          <p className="app-sidebar__eyebrow">Studio métier</p>
          <h1 className="app-sidebar__title">Devis Peintre</h1>
          <p className="app-sidebar__subtitle">
            Interface premium pour devis, clients et factures.
          </p>
        </div>
      </div>

      <nav className="app-sidebar__nav" aria-label="Navigation principale">
        <div className="app-sidebar__section">
          <p className="app-sidebar__section-title">Pilotage</p>

          <NavLink to="/" end className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon">▦</span>
            <span>Devis</span>
          </NavLink>

          <NavLink to="/clients" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon">◌</span>
            <span>Clients</span>
          </NavLink>

          <NavLink to="/catalogue" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon">◇</span>
            <span>Catalogue</span>
          </NavLink>

          <NavLink to="/factures" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon">▤</span>
            <span>Factures</span>
          </NavLink>
        </div>

        <div className="app-sidebar__section">
          <p className="app-sidebar__section-title">Configuration</p>

          <NavLink to="/parametres" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon">⚙</span>
            <span>Paramètres</span>
          </NavLink>
        </div>
      </nav>

      <div className="app-sidebar__footer">
        <div className="app-sidebar__footer-card">
          <p className="app-sidebar__footer-label">Ambiance visuelle</p>
          <p className="app-sidebar__footer-text">
            Palette sable, noisette et espresso pour un rendu plus premium et plus doux.
          </p>
        </div>
      </div>
    </aside>
  );
}