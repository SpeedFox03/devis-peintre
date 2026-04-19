import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Button } from "../../components/ui/Button/Button";
import "./Sidebar.css";

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
  return `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`.trim();
}

function getInitials(email?: string | null) {
  if (!email) return "U";
  return email.slice(0, 2).toUpperCase();
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="app-sidebar__mobile-bar">
        <div className="app-sidebar__brand-mark">DP</div>
        <span className="app-sidebar__mobile-title">Devis Peintre</span>
        <Button
          className="app-sidebar__hamburger"
          aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? "✕" : "☰"}
        </Button>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="app-sidebar__overlay"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? "app-sidebar--mobile-open" : ""}`}>
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

            <NavLink to="/" end className={getNavLinkClassName} onClick={() => setMobileOpen(false)}>
              <span className="app-sidebar__link-icon">▦</span>
              <span>Devis</span>
            </NavLink>

            <NavLink to="/clients" className={getNavLinkClassName} onClick={() => setMobileOpen(false)}>
              <span className="app-sidebar__link-icon">◌</span>
              <span>Clients</span>
            </NavLink>

            <NavLink to="/catalogue" className={getNavLinkClassName} onClick={() => setMobileOpen(false)}>
              <span className="app-sidebar__link-icon">◇</span>
              <span>Catalogue</span>
            </NavLink>

            <NavLink to="/factures" className={getNavLinkClassName} onClick={() => setMobileOpen(false)}>
              <span className="app-sidebar__link-icon">▤</span>
              <span>Factures</span>
            </NavLink>
          </div>

          <div className="app-sidebar__section">
            <p className="app-sidebar__section-title">Configuration</p>

            <NavLink to="/parametres" className={getNavLinkClassName} onClick={() => setMobileOpen(false)}>
              <span className="app-sidebar__link-icon">⚙</span>
              <span>Paramètres</span>
            </NavLink>
          </div>
        </nav>

        <div className="app-sidebar__footer">
          {/* Carte utilisateur + déconnexion — visible uniquement sur mobile */}
          <div className="app-sidebar__user-block">
            <div className="app-sidebar__user-info">
              <div className="app-sidebar__user-avatar">
                {getInitials(user?.email)}
              </div>
              <div className="app-sidebar__user-meta">
                <span className="app-sidebar__user-label">Connecté en tant que</span>
                <strong className="app-sidebar__user-email">
                  {user?.email ?? "Utilisateur"}
                </strong>
              </div>
            </div>
            <button className="app-sidebar__logout" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>


        </div>
      </aside>
    </>
  );
}