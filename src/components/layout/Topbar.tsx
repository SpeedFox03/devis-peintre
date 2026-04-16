import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../features/auth/hooks/useAuth";

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 16,
        borderBottom: "1px solid #e5e7eb",
        marginBottom: 24,
      }}
    >
      <div>
        <strong>Application de devis</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>{user?.email ?? "Utilisateur"}</span>
        <button onClick={handleLogout}>Déconnexion</button>
      </div>
    </header>
  );
}