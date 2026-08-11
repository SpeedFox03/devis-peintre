import { NavLink } from "react-router-dom";
import {
  CatalogIcon,
  HomeIcon,
  InvoiceIcon,
  LockIcon,
  ProjectIcon,
  QuoteIcon,
  SettingsIcon,
  UsersIcon,
} from "../../components/ui/Icons/AppIcons";
import { usePlatformAdmin } from "../../features/admin/usePlatformAdmin";
import "./Sidebar.css";

function getNavLinkClassName({ isActive }: { isActive: boolean }) {
  return `app-sidebar__link ${isActive ? "app-sidebar__link--active" : ""}`.trim();
}

export function Sidebar() {
  const { isPlatformAdmin } = usePlatformAdmin();
  return (
    <aside className="app-sidebar">
      <NavLink to="/" className="app-sidebar__brand" aria-label="Tableau de bord">
        <div className="app-sidebar__brand-mark">DP</div>

        <div>
          <p className="app-sidebar__eyebrow">Espace artisan</p>
          <p className="app-sidebar__title">Devis Peintre</p>
        </div>
      </NavLink>

      <nav className="app-sidebar__nav" aria-label="Navigation principale">
        <div className="app-sidebar__section">
          <p className="app-sidebar__section-title">Activité</p>

          <NavLink to="/" end className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><HomeIcon /></span>
            <span>Tableau de bord</span>
          </NavLink>

          <NavLink to="/clients" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><UsersIcon /></span>
            <span>Clients</span>
          </NavLink>

          <NavLink to="/projets" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><ProjectIcon /></span>
            <span>Projets</span>
          </NavLink>

          <NavLink to="/devis" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><QuoteIcon /></span>
            <span>Devis</span>
          </NavLink>

          <NavLink to="/factures" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><InvoiceIcon /></span>
            <span>Factures</span>
          </NavLink>
        </div>

        <div className="app-sidebar__section">
          <p className="app-sidebar__section-title">Outils</p>

          <NavLink to="/catalogue" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><CatalogIcon /></span>
            <span>Catalogue</span>
          </NavLink>

          <NavLink to="/fournisseurs" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><CatalogIcon /></span>
            <span>Fournisseurs</span>
          </NavLink>
        </div>
      </nav>

      <div className="app-sidebar__footer">
        {isPlatformAdmin ? (
          <NavLink to="/admin" className={getNavLinkClassName}>
            <span className="app-sidebar__link-icon"><LockIcon /></span>
            <span>Administration</span>
          </NavLink>
        ) : null}
        <NavLink to="/abonnement" className={getNavLinkClassName}>
          <span className="app-sidebar__link-icon"><LockIcon /></span>
          <span>Abonnement</span>
        </NavLink>
        <NavLink to="/parametres" className={getNavLinkClassName}>
          <span className="app-sidebar__link-icon"><SettingsIcon /></span>
          <span>Paramètres</span>
        </NavLink>
      </div>
    </aside>
  );
}
