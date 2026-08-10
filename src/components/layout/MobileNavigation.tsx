import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/hooks/useAuth";
import {
  CatalogIcon,
  HomeIcon,
  LockIcon,
  MoreIcon,
  ProjectIcon,
  QuoteIcon,
  SettingsIcon,
  UsersIcon,
} from "../ui/Icons/AppIcons";
import { usePlatformAdmin } from "../../features/admin/usePlatformAdmin";
import "./MobileNavigation.css";

const primaryItems = [
  { to: "/", label: "Accueil", icon: <HomeIcon />, end: true },
  { to: "/clients", label: "Clients", icon: <UsersIcon /> },
  { to: "/projets", label: "Projets", icon: <ProjectIcon /> },
  { to: "/devis", label: "Devis", icon: <QuoteIcon /> },
] as const;

function getInitials(email?: string | null) {
  if (!email) return "U";
  return email.slice(0, 2).toUpperCase();
}

export function MobileNavigation() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPlatformAdmin } = usePlatformAdmin();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  const moreActive = ["/catalogue", "/parametres", "/abonnement", "/admin"].some((path) =>
    location.pathname.startsWith(path),
  );

  return (
    <>
      {moreOpen && (
        <button
          className="mobile-navigation__overlay"
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMoreOpen(false)}
        />
      )}

      <aside
        className={`mobile-navigation__sheet${moreOpen ? " mobile-navigation__sheet--open" : ""}`}
        aria-hidden={!moreOpen}
      >
        <div className="mobile-navigation__sheet-handle" />
        <div className="mobile-navigation__account">
          <span className="mobile-navigation__avatar">{getInitials(user?.email)}</span>
          <span className="mobile-navigation__account-copy">
            <small>Compte connecté</small>
            <strong>{user?.email ?? "Utilisateur"}</strong>
          </span>
        </div>

        <nav className="mobile-navigation__more-links" aria-label="Navigation secondaire">
          <NavLink to="/catalogue" className="mobile-navigation__more-link" onClick={() => setMoreOpen(false)}>
            <CatalogIcon />
            <span>Catalogue</span>
          </NavLink>
          <NavLink to="/parametres" className="mobile-navigation__more-link" onClick={() => setMoreOpen(false)}>
            <SettingsIcon />
            <span>Paramètres</span>
          </NavLink>
          <NavLink to="/abonnement" className="mobile-navigation__more-link" onClick={() => setMoreOpen(false)}>
            <LockIcon />
            <span>Abonnement</span>
          </NavLink>
          {isPlatformAdmin ? (
            <NavLink to="/admin" className="mobile-navigation__more-link" onClick={() => setMoreOpen(false)}>
              <LockIcon />
              <span>Administration</span>
            </NavLink>
          ) : null}
        </nav>

        <button className="mobile-navigation__logout" type="button" onClick={handleLogout}>
          Se déconnecter
        </button>
      </aside>

      <nav className="mobile-navigation" aria-label="Navigation principale mobile">
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setMoreOpen(false)}
            className={({ isActive }) =>
              `mobile-navigation__item${isActive ? " mobile-navigation__item--active" : ""}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          className={`mobile-navigation__item${moreActive || moreOpen ? " mobile-navigation__item--active" : ""}`}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((current) => !current)}
        >
          <MoreIcon />
          <span>Plus</span>
        </button>
      </nav>
    </>
  );
}
