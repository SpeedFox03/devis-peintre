import { Link } from "react-router-dom";
import { useAuth } from "../../auth/hooks/useAuth";
import "./HomePage.css";

type NavCard = {
  to: string;
  icon: string;
  eyebrow: string;
  label: string;
  description: string;
  featured?: boolean;
};

const NAV_CARDS: NavCard[] = [
  {
    to: "/devis",
    icon: "▦",
    eyebrow: "Pilotage",
    label: "Devis",
    description: "Créez, modifiez et envoyez vos devis. Suivez leur statut jusqu'à l'acceptation.",
    featured: true,
  },
  {
    to: "/clients",
    icon: "◌",
    eyebrow: "Pilotage",
    label: "Clients",
    description: "Gérez votre portefeuille clients, leurs coordonnées et leur historique.",
    featured: true,
  },
  {
    to: "/factures",
    icon: "▤",
    eyebrow: "Comptabilité",
    label: "Factures",
    description: "Transformez vos devis acceptés en factures et suivez les règlements.",
  },
  {
    to: "/catalogue",
    icon: "◇",
    eyebrow: "Configuration",
    label: "Catalogue",
    description: "Gérez vos prestations types, unités et tarifs pour accélérer la saisie.",
  },
  {
    to: "/parametres",
    icon: "⚙",
    eyebrow: "Configuration",
    label: "Paramètres",
    description: "Coordonnées entreprise, logo, TVA par défaut et mise en page PDF.",
  },
];

function getFirstName(email?: string | null) {
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function HomePage() {
  const { user } = useAuth();
  const firstName = getFirstName(user?.email);

  return (
    <section className="home-page">
      <header className="home-page__hero">
        <p className="home-page__eyebrow">Tableau de bord</p>
        <h1 className="home-page__title">
          {firstName ? `Bonjour, ${firstName} !` : "Bonjour !"}
        </h1>
        <p className="home-page__subtitle">
          Que souhaitez-vous faire aujourd'hui ?
        </p>
      </header>

      <nav className="home-page__grid" aria-label="Navigation principale">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`home-page__card${card.featured ? " home-page__card--featured" : ""}`}
          >
            <div className="home-page__card-icon-wrap">
              <span className="home-page__card-icon" aria-hidden="true">
                {card.icon}
              </span>
            </div>

            <div className="home-page__card-body">
              <p className="home-page__card-eyebrow">{card.eyebrow}</p>
              <h2 className="home-page__card-title">{card.label}</h2>
              <p className="home-page__card-desc">{card.description}</p>
            </div>

            <span className="home-page__card-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
