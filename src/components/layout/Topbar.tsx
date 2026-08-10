import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/hooks/useAuth";
import { Button } from "../../components/ui/Button/Button";
import "./Topbar.css";

function getInitials(email?: string | null) {
  if (!email) return "U";
  return email.slice(0, 2).toUpperCase();
}

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const page = (() => {
    const path = location.pathname;
    if (path === "/") return { eyebrow: "Aujourd’hui", title: "Tableau de bord" };
    if (path.startsWith("/clients/")) return { eyebrow: "Clients", title: "Fiche client" };
    if (path.startsWith("/clients")) return { eyebrow: "Activité", title: "Clients" };
    if (path.startsWith("/projets/")) return { eyebrow: "Projets", title: "Détail du projet" };
    if (path.startsWith("/projets")) return { eyebrow: "Activité", title: "Projets" };
    if (path.startsWith("/devis/")) return { eyebrow: "Devis", title: "Détail du devis" };
    if (path.startsWith("/devis")) return { eyebrow: "Activité", title: "Devis" };
    if (path.startsWith("/catalogue")) return { eyebrow: "Outils", title: "Catalogue" };
    if (path.startsWith("/admin")) return { eyebrow: "Plateforme", title: "Administration" };
    if (path.startsWith("/parametres")) return { eyebrow: "Compte", title: "Paramètres" };
    return { eyebrow: "Espace de travail", title: "Devis Peintre" };
  })();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar__mobile-brand" aria-hidden="true">DP</div>
      <div className="app-topbar__intro">
        <p className="app-topbar__eyebrow">{page.eyebrow}</p>
        <h2 className="app-topbar__title">{page.title}</h2>
      </div>

      <div className="app-topbar__actions">
        <div className="app-topbar__user-card">
          <div className="app-topbar__avatar">{getInitials(user?.email)}</div>

          <div className="app-topbar__user-meta">
            <span className="app-topbar__user-label">Connecté en tant que</span>
            <strong className="app-topbar__user-email">
              {user?.email ?? "Utilisateur"}
            </strong>
          </div>
        </div>

        <Button className="app-topbar__logout" onClick={handleLogout}>
          Déconnexion
        </Button>
      </div>
    </header>
  );
}
