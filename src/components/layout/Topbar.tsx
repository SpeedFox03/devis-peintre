import { useNavigate } from "react-router-dom";
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

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <header className="app-topbar">
      <div className="app-topbar__intro">
        <p className="app-topbar__eyebrow">Espace de travail</p>
        <h2 className="app-topbar__title">Tableau de production</h2>
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