import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { DataTable } from "../../../components/ui/DataTable/DataTable";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import {
  useCustomerDetails,
  getCustomerName,
  getStatusLabel,
  formatCurrency,
} from "../hooks/useCustomerDetails";
import "./CustomerDetailsPage.css";

const customerPages = [
  { id: "quotes", label: "Devis" },
  { id: "info",   label: "Informations" },
] as const;

type CustomerPageId = (typeof customerPages)[number]["id"];

export function CustomerDetailsPage() {
  const {
    customer,
    quotes,
    loading,
    saving,
    archiving,
    error,
    form,
    isDirty,
    stats,
    addresses,
    updateField,
    resetForm,
    handleSubmit,
    handleArchiveCustomer,
  } = useCustomerDetails();

  const [activePage, setActivePage] = useState<CustomerPageId>("quotes");
  const [topbarPortalTarget, setTopbarPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    const topbar = document.querySelector(".app-topbar");
    setTopbarPortalTarget(topbar);
    topbar?.classList.add("app-topbar--with-quote-nav");
    return () => { topbar?.classList.remove("app-topbar--with-quote-nav"); };
  }, []);

  if (loading) {
    return <LoadingBlock message="Chargement du client..." />;
  }

  if (error && !customer) {
    return <ErrorMessage message={error} />;
  }

  if (!customer) {
    return (
      <EmptyState
        title="Client introuvable"
        description="Ce client n'existe pas ou n'est pas accessible."
      />
    );
  }

  const tabNav = (
    <nav className="quote-topbar-nav" aria-label="Pages du client">
      {customerPages.map((page) => (
        <button
          key={page.id}
          type="button"
          className={`quote-topbar-nav__tab${activePage === page.id ? " quote-topbar-nav__tab--active" : ""}`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </button>
      ))}
    </nav>
  );

  const tabNavMobile = (
    <div className="quote-page-tabs-mobile" aria-label="Pages du client">
      {customerPages.map((page) => (
        <button
          key={page.id}
          type="button"
          className={`quote-topbar-nav__tab${activePage === page.id ? " quote-topbar-nav__tab--active" : ""}`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </button>
      ))}
    </div>
  );

  return (
    <section className="customer-details-premium-page">
      {topbarPortalTarget ? createPortal(tabNav, topbarPortalTarget) : null}

      <header className="customer-details-premium-page__hero">
        <div className="customer-details-premium-page__hero-main">
          <div className="customer-details-premium-page__topline">
            <Link to="/clients" className="customer-details-premium-page__backlink">
              ← Retour aux clients
            </Link>
          </div>

          <p className="customer-details-premium-page__eyebrow">Fiche client</p>
          <h1 className="customer-details-premium-page__title">
            {getCustomerName(customer)}
          </h1>
          <p className="customer-details-premium-page__description">
            Consulte les coordonnées, mets à jour les informations principales
            et retrouve rapidement l'historique des devis associés.
          </p>
        </div>

        <div className="customer-details-premium-page__hero-actions">
          <Link to={`/?new=1&customerId=${customer.id}`}>
            <Button type="button">Créer un devis</Button>
          </Link>

          <Button
            type="button"
            variant="secondary"
            onClick={handleArchiveCustomer}
            disabled={archiving}
          >
            {archiving ? "Archivage..." : "Archiver"}
          </Button>
        </div>
      </header>

      {tabNavMobile}

      <div className="customer-details-premium-page__stats">
        <Card>
          <p className="customer-details-premium-page__stat-label">Devis liés</p>
          <p className="customer-details-premium-page__stat-value">{quotes.length}</p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">Devis acceptés</p>
          <p className="customer-details-premium-page__stat-value">
            {stats.acceptedQuotesCount}
          </p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">Potentiel signé</p>
          <p className="customer-details-premium-page__stat-value">
            {formatCurrency(stats.totalPotentialSigned)}
          </p>
        </Card>

        <Card>
          <p className="customer-details-premium-page__stat-label">Créé le</p>
          <p className="customer-details-premium-page__stat-value customer-details-premium-page__stat-value--date">
            {new Date(customer.created_at).toLocaleDateString("fr-BE")}
          </p>
        </Card>
      </div>

      {/* ── Onglet Devis ── */}
      {activePage === "quotes" && (
        <Card>
          <div className="customer-details-premium-page__section-header">
            <div>
              <p className="customer-details-premium-page__section-eyebrow">Historique</p>
              <h2 className="customer-details-premium-page__section-title">Devis liés</h2>
            </div>
          </div>

          {quotes.length === 0 ? (
            <EmptyState
              title="Aucun devis lié"
              description="Ce client ne possède encore aucun devis. Crée-en un pour démarrer son historique commercial."
            />
          ) : (
            <>
              {/* ── Tableau desktop ── */}
              <div className="customer-details-premium-page__table-shell">
                <DataTable
                  headers={
                    <tr>
                      <th>Numéro</th>
                      <th>Titre</th>
                      <th>Statut</th>
                      <th>Date</th>
                      <th style={{ textAlign: "right" }}>Total TTC</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  }
                >
                  {quotes.map((quote) => (
                    <tr key={quote.id}>
                      <td>
                        <span className="customer-details-premium-page__quote-number">
                          {quote.quote_number}
                        </span>
                      </td>
                      <td>{quote.title}</td>
                      <td>{getStatusLabel(quote.status)}</td>
                      <td>{quote.issue_date}</td>
                      <td style={{ textAlign: "right" }}>
                        <strong>{formatCurrency(quote.total_ttc)}</strong>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link to={`/devis/${quote.id}`}>
                          <Button type="button" variant="secondary">Ouvrir</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              </div>

              {/* ── Vue cartes mobile ── */}
              <div className="customer-details-premium-page__quote-card-list">
                {quotes.map((quote) => (
                  <article
                    key={quote.id}
                    className="customer-details-premium-page__quote-card"
                  >
                    <div className="customer-details-premium-page__quote-card-header">
                      <div className="customer-details-premium-page__quote-card-main">
                        <span className="customer-details-premium-page__quote-number">
                          {quote.quote_number}
                        </span>
                        <Link
                          to={`/devis/${quote.id}`}
                          className="customer-details-premium-page__quote-card-title"
                        >
                          {quote.title}
                        </Link>
                      </div>
                      <span className="customer-details-premium-page__quote-card-total">
                        {formatCurrency(quote.total_ttc)}
                      </span>
                    </div>

                    <div className="customer-details-premium-page__quote-card-meta">
                      <span className="customer-details-premium-page__quote-card-date">
                        {quote.issue_date}
                      </span>
                      <span className="customer-details-premium-page__quote-card-status">
                        {getStatusLabel(quote.status)}
                      </span>
                    </div>

                    <div className="customer-details-premium-page__quote-card-actions">
                      <Link to={`/devis/${quote.id}`} style={{ flex: "1 1 auto" }}>
                        <Button
                          type="button"
                          variant="secondary"
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          Ouvrir
                        </Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── Onglet Informations ── */}
      {activePage === "info" && (
        <div className="customer-details-premium-page__layout">
          <aside className="customer-details-premium-page__left">
            <Card>
              <div className="customer-details-premium-page__side-card">
                <p className="customer-details-premium-page__side-label">Résumé</p>

                <ul className="customer-details-premium-page__meta-list">
                  <li>
                    <span>Email</span>
                    <strong>{customer.email || "-"}</strong>
                  </li>
                  <li>
                    <span>Téléphone</span>
                    <strong>{customer.phone || "-"}</strong>
                  </li>
                  <li>
                    <span>Adresse facturation</span>
                    <strong>{addresses.billingAddress || "-"}</strong>
                  </li>
                  <li>
                    <span>Adresse chantier</span>
                    <strong>{addresses.jobsiteAddress || "-"}</strong>
                  </li>
                </ul>
              </div>
            </Card>
          </aside>

          <div className="customer-details-premium-page__center">
            <Card>
              <div className="customer-details-premium-page__section-header">
                <div>
                  <p className="customer-details-premium-page__section-eyebrow">
                    Informations
                  </p>
                  <h2 className="customer-details-premium-page__section-title">
                    Modifier la fiche client
                    {/* Indicateur visuel de modifications non sauvegardées */}
                    {isDirty && (
                      <span
                        style={{
                          display: "inline-block",
                          marginLeft: "10px",
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#b45309",
                          background: "rgba(251, 191, 36, 0.15)",
                          border: "1px solid rgba(217, 119, 6, 0.25)",
                          borderRadius: "999px",
                          padding: "2px 10px",
                          verticalAlign: "middle",
                        }}
                      >
                        Modifications non sauvegardées
                      </span>
                    )}
                  </h2>
                </div>
              </div>

              <form
                className="customer-details-premium-page__form"
                onSubmit={handleSubmit}
              >
                <FormGrid columns="2">
                  <FormField label="Société">
                    <TextInput
                      value={form.company_name}
                      onChange={(e) => updateField("company_name", e.target.value)}
                    />
                  </FormField>

                  <FormField label="Email">
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                  </FormField>
                </FormGrid>

                <FormGrid columns="2">
                  <FormField label="Prénom">
                    <TextInput
                      value={form.first_name}
                      onChange={(e) => updateField("first_name", e.target.value)}
                    />
                  </FormField>

                  <FormField label="Nom">
                    <TextInput
                      value={form.last_name}
                      onChange={(e) => updateField("last_name", e.target.value)}
                    />
                  </FormField>
                </FormGrid>

                <FormGrid columns="2">
                  <FormField label="Téléphone">
                    <TextInput
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </FormField>

                  <FormField label="Pays facturation">
                    <TextInput
                      value={form.billing_country}
                      onChange={(e) => updateField("billing_country", e.target.value)}
                    />
                  </FormField>
                </FormGrid>

                <div className="customer-details-premium-page__address-block">
                  <h3 className="customer-details-premium-page__subsection-title">
                    Adresse de facturation
                  </h3>

                  <FormGrid columns="2">
                    <FormField label="Adresse ligne 1">
                      <TextInput
                        value={form.billing_address_line1}
                        onChange={(e) => updateField("billing_address_line1", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Adresse ligne 2">
                      <TextInput
                        value={form.billing_address_line2}
                        onChange={(e) => updateField("billing_address_line2", e.target.value)}
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid columns="3">
                    <FormField label="Code postal">
                      <TextInput
                        value={form.billing_postal_code}
                        onChange={(e) => updateField("billing_postal_code", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Ville">
                      <TextInput
                        value={form.billing_city}
                        onChange={(e) => updateField("billing_city", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Pays">
                      <TextInput
                        value={form.billing_country}
                        onChange={(e) => updateField("billing_country", e.target.value)}
                      />
                    </FormField>
                  </FormGrid>
                </div>

                <div className="customer-details-premium-page__address-block">
                  <h3 className="customer-details-premium-page__subsection-title">
                    Adresse chantier
                  </h3>

                  <FormGrid columns="2">
                    <FormField label="Adresse ligne 1">
                      <TextInput
                        value={form.jobsite_address_line1}
                        onChange={(e) => updateField("jobsite_address_line1", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Adresse ligne 2">
                      <TextInput
                        value={form.jobsite_address_line2}
                        onChange={(e) => updateField("jobsite_address_line2", e.target.value)}
                      />
                    </FormField>
                  </FormGrid>

                  <FormGrid columns="3">
                    <FormField label="Code postal">
                      <TextInput
                        value={form.jobsite_postal_code}
                        onChange={(e) => updateField("jobsite_postal_code", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Ville">
                      <TextInput
                        value={form.jobsite_city}
                        onChange={(e) => updateField("jobsite_city", e.target.value)}
                      />
                    </FormField>

                    <FormField label="Pays">
                      <TextInput
                        value={form.jobsite_country}
                        onChange={(e) => updateField("jobsite_country", e.target.value)}
                      />
                    </FormField>
                  </FormGrid>
                </div>

                <FormField label="Notes">
                  <TextArea
                    rows={5}
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                </FormField>

                {error && <ErrorMessage message={error} />}

                <div className="customer-details-premium-page__form-actions">
                  <Button type="submit" disabled={saving || !isDirty}>
                    {saving ? "Enregistrement..." : "Enregistrer"}
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    disabled={!isDirty}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
}