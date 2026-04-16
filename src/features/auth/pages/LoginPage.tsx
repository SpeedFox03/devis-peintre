import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import "./LoginPage.css";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="login-page">
      <Card>
        <h1 className="login-page__title">Connexion</h1>
        <p className="login-page__subtitle">
          Connecte-toi pour accéder à tes devis et tes clients.
        </p>

        <form className="login-page__form" onSubmit={handleSubmit}>
          <FormField label="Email">
            <TextInput
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>

          <FormField label="Mot de passe">
            <TextInput
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>

          <Button type="submit" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>

          {error && <ErrorMessage message={error} />}
        </form>
      </Card>
    </div>
  );
}