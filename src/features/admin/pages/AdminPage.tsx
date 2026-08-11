import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { Drawer } from "../../../components/ui/Drawer/Drawer";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { PlusIcon } from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Select } from "../../../components/ui/Select/Select";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { formatDisplayDate } from "../../../lib/formatters";
import { loadAdminView, runAdminAction } from "../adminRepository";
import type { AdminConsoleData, AdminView } from "../adminRepository";
import "./AdminPage.css";

const tabs: Array<{ id: AdminView; label: string }> = [
  { id: "overview", label: "Vue d’ensemble" },
  { id: "accounts", label: "Comptes" },
  { id: "subscriptions", label: "Abonnements" },
  { id: "designs", label: "Modèles" },
  { id: "promotions", label: "Promotions" },
];

const emptyPromotion = { code: "", discount_type: "percentage", value: "", starts_at: "", ends_at: "", max_redemptions: "" };
const emptyDesign = { name: "", slug: "", description: "", renderer_key: "standard", visibility: "private" };
type AccountSort = "recent" | "oldest" | "name" | "company" | "activity";

function normalizeSearchValue(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
}

export function AdminPage() {
  const [activeView, setActiveView] = useState<AdminView>("overview");
  const [data, setData] = useState<AdminConsoleData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promotionOpen, setPromotionOpen] = useState(false);
  const [promotion, setPromotion] = useState(emptyPromotion);
  const [designOpen, setDesignOpen] = useState(false);
  const [design, setDesign] = useState(emptyDesign);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await loadAdminView(activeView);
        if (!cancelled) setData(loaded);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeView]);

  async function createPromotion(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await runAdminAction("create_promotion", {
        code: promotion.code.trim().toUpperCase(),
        discount_type: promotion.discount_type,
        value: Number(promotion.value),
        starts_at: promotion.starts_at || null,
        ends_at: promotion.ends_at || null,
        max_redemptions: promotion.max_redemptions ? Number(promotion.max_redemptions) : null,
        max_redemptions_per_company: 1,
      });
      setPromotion(emptyPromotion);
      setPromotionOpen(false);
      setData(await loadAdminView("promotions"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function createDesign(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await runAdminAction("create_design", design);
      setDesign(emptyDesign);
      setDesignOpen(false);
      setData(await loadAdminView("designs"));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-page">
      <header className="admin-page__header">
        <div><p>Administration plateforme</p><h1>Centre de contrôle</h1><span>Comptes, abonnements, modèles privés et promotions.</span></div>
        {activeView === "promotions" ? <Button type="button" onClick={() => setPromotionOpen(true)}><PlusIcon /> Nouveau code</Button> : null}
        {activeView === "designs" ? <Button type="button" onClick={() => setDesignOpen(true)}><PlusIcon /> Nouveau modèle</Button> : null}
      </header>

      <nav className="admin-page__tabs" aria-label="Sections d’administration">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeView === tab.id ? "admin-page__tab--active" : ""}
            aria-current={activeView === tab.id ? "page" : undefined}
            onClick={() => setActiveView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {error ? <ErrorMessage message={error} /> : null}
      {loading ? <LoadingBlock message="Chargement de l’administration..." /> : (
        <div className="admin-page__content">
          {activeView === "overview" ? <Overview data={data} /> : null}
          {activeView === "accounts" ? <Accounts data={data} /> : null}
          {activeView === "subscriptions" ? (
            <Subscriptions
              data={data}
              onChanged={async () => setData(await loadAdminView("subscriptions"))}
            />
          ) : null}
          {activeView === "designs" ? <Designs data={data} onChanged={async () => setData(await loadAdminView("designs"))} /> : null}
          {activeView === "promotions" ? <Promotions data={data} onChanged={async () => setData(await loadAdminView("promotions"))} /> : null}
        </div>
      )}

      <Drawer open={promotionOpen} title="Nouveau code promotionnel" description="Définissez sa remise, sa période et sa limite d’utilisation." onClose={() => setPromotionOpen(false)}>
        <form className="admin-page__form" onSubmit={createPromotion}>
          <FormField label="Code"><TextInput value={promotion.code} onChange={(event) => setPromotion((current) => ({ ...current, code: event.target.value }))} placeholder="BIENVENUE20" /></FormField>
          <FormGrid columns="2">
            <FormField label="Type"><Select value={promotion.discount_type} onChange={(event) => setPromotion((current) => ({ ...current, discount_type: event.target.value }))}><option value="percentage">Pourcentage</option><option value="fixed">Montant fixe</option></Select></FormField>
            <FormField label="Valeur"><TextInput type="number" min="0" step="0.01" value={promotion.value} onChange={(event) => setPromotion((current) => ({ ...current, value: event.target.value }))} /></FormField>
          </FormGrid>
          <FormGrid columns="2"><FormField label="Début"><TextInput type="datetime-local" value={promotion.starts_at} onChange={(event) => setPromotion((current) => ({ ...current, starts_at: event.target.value }))} /></FormField><FormField label="Fin"><TextInput type="datetime-local" value={promotion.ends_at} onChange={(event) => setPromotion((current) => ({ ...current, ends_at: event.target.value }))} /></FormField></FormGrid>
          <FormField label="Nombre maximal d’utilisations"><TextInput type="number" min="1" value={promotion.max_redemptions} onChange={(event) => setPromotion((current) => ({ ...current, max_redemptions: event.target.value }))} /></FormField>
          <div className="admin-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer le code"}</Button><Button type="button" variant="secondary" onClick={() => setPromotionOpen(false)}>Annuler</Button></div>
        </form>
      </Drawer>

      <Drawer open={designOpen} title="Nouveau modèle de devis" description="Créez le modèle puis assignez-le aux entreprises autorisées." onClose={() => setDesignOpen(false)}>
        <form className="admin-page__form" onSubmit={createDesign}>
          <FormField label="Nom"><TextInput value={design.name} onChange={(event) => setDesign((current) => ({ ...current, name: event.target.value }))} placeholder="Design Atelier" /></FormField>
          <FormField label="Identifiant"><TextInput value={design.slug} onChange={(event) => setDesign((current) => ({ ...current, slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") }))} placeholder="design-atelier" /></FormField>
          <FormField label="Description"><TextInput value={design.description} onChange={(event) => setDesign((current) => ({ ...current, description: event.target.value }))} /></FormField>
          <FormGrid columns="2">
            <FormField label="Moteur visuel"><Select value={design.renderer_key} onChange={(event) => setDesign((current) => ({ ...current, renderer_key: event.target.value }))}><option value="standard">Standard</option><option value="elegant">Élégant</option></Select></FormField>
            <FormField label="Visibilité"><Select value={design.visibility} onChange={(event) => setDesign((current) => ({ ...current, visibility: event.target.value }))}><option value="private">Privé</option><option value="public">Public</option></Select></FormField>
          </FormGrid>
          <div className="admin-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer le modèle"}</Button><Button type="button" variant="secondary" onClick={() => setDesignOpen(false)}>Annuler</Button></div>
        </form>
      </Drawer>
    </section>
  );
}

function Overview({ data }: { data: AdminConsoleData }) {
  const metrics = data.metrics ?? { companies: 0, users: 0, activeSubscriptions: 0, privateDesigns: 0 };
  return <div className="admin-page__metrics"><Card><span>Entreprises</span><strong>{metrics.companies}</strong></Card><Card><span>Utilisateurs</span><strong>{metrics.users}</strong></Card><Card><span>Abonnements actifs</span><strong>{metrics.activeSubscriptions}</strong></Card><Card><span>Modèles privés</span><strong>{metrics.privateDesigns}</strong></Card></div>;
}

function Accounts({ data }: { data: AdminConsoleData }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AccountSort>("recent");
  const accounts = data.accounts;
  const visibleAccounts = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query.trim());
    const filtered = (accounts ?? []).filter((account) => {
      if (!normalizedQuery) return true;
      return normalizeSearchValue([
        account.full_name,
        account.email,
        account.company_name,
        account.role,
        account.status,
        account.subscription_status,
      ].filter(Boolean).join(" ")).includes(normalizedQuery);
    });

    return filtered.sort((left, right) => {
      if (sort === "oldest") return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      if (sort === "name") return (left.full_name || left.email).localeCompare(right.full_name || right.email, "fr", { sensitivity: "base" });
      if (sort === "company") {
        if (!left.company_name) return right.company_name ? 1 : 0;
        if (!right.company_name) return -1;
        return left.company_name.localeCompare(right.company_name, "fr", { sensitivity: "base" });
      }
      if (sort === "activity") return new Date(right.last_seen_at || 0).getTime() - new Date(left.last_seen_at || 0).getTime();
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [accounts, query, sort]);

  if (!accounts?.length) return <EmptyState title="Aucun compte" description="Les comptes apparaîtront ici après activation." />;
  return (
    <div className="admin-page__accounts">
      <Card className="admin-page__account-tools">
        <FormField label="Rechercher">
          <TextInput
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nom, e-mail ou entreprise…"
          />
        </FormField>
        <FormField label="Trier par">
          <Select value={sort} onChange={(event) => setSort(event.target.value as AccountSort)}>
            <option value="recent">Inscription récente</option>
            <option value="oldest">Inscription ancienne</option>
            <option value="name">Nom A–Z</option>
            <option value="company">Entreprise A–Z</option>
            <option value="activity">Dernière activité</option>
          </Select>
        </FormField>
        <span className="admin-page__account-count" aria-live="polite">
          {visibleAccounts.length} compte{visibleAccounts.length === 1 ? "" : "s"}
        </span>
      </Card>

      {visibleAccounts.length ? (
        <Card className="admin-page__table-wrap">
          <table>
            <thead>
              <tr><th>Utilisateur</th><th>Entreprise</th><th>Rôle</th><th>Inscription</th><th>Dernière activité</th><th>Abonnement</th><th>Échéance</th><th>Compte</th></tr>
            </thead>
            <tbody>
              {visibleAccounts.map((account) => (
                <tr key={account.user_id}>
                  <td className="admin-page__cell--primary" data-label="Utilisateur"><strong>{account.full_name || account.email}</strong><small>{account.email}</small></td>
                  <td data-label="Entreprise">{account.company_name || "—"}</td>
                  <td data-label="Rôle">{account.role || "—"}</td>
                  <td data-label="Inscription">{formatDisplayDate(account.created_at)}</td>
                  <td data-label="Dernière activité">{formatDisplayDate(account.last_seen_at)}</td>
                  <td data-label="Abonnement"><span className="admin-page__status">{account.subscription_status}{account.billing_interval ? ` · ${account.billing_interval === "year" ? "annuel" : "mensuel"}` : ""}</span></td>
                  <td data-label="Échéance">{formatDisplayDate(account.current_period_end)}</td>
                  <td data-label="Compte"><span className="admin-page__status">{account.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState title="Aucun résultat" description="Essayez un autre nom, e-mail, entreprise ou statut." />
      )}
    </div>
  );
}

function Subscriptions({
  data,
  onChanged,
}: {
  data: AdminConsoleData;
  onChanged: () => Promise<void>;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [priceId, setPriceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prices = data.planPrices ?? [];
  const companies = data.companies ?? [];
  const requests = data.subscriptionRequests ?? [];

  function openActivation(nextCompanyId = "", nextPriceId = "") {
    setCompanyId(nextCompanyId);
    setPriceId(nextPriceId || prices[0]?.id || "");
    setError(null);
    setDrawerOpen(true);
  }

  async function activateSubscription(event: FormEvent) {
    event.preventDefault();
    if (!companyId || !priceId) return;
    setSaving(true);
    setError(null);
    try {
      await runAdminAction("activate_subscription", {
        company_id: companyId,
        price_id: priceId,
      });
      await onChanged();
      setDrawerOpen(false);
      setCompanyId("");
      setPriceId("");
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Activation impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-page__subscriptions">
      <div className="admin-page__section-heading">
        <div>
          <h2>Gestion des abonnements</h2>
          <p>Validez une demande ou activez directement un compte client.</p>
        </div>
        <Button type="button" onClick={() => openActivation()}>
          <PlusIcon /> Activer un compte
        </Button>
      </div>

      {requests.length > 0 ? (
        <div className="admin-page__request-list">
          <div className="admin-page__section-heading">
            <div>
              <h3>Demandes en attente</h3>
              <p>{requests.length} demande(s) à traiter.</p>
            </div>
          </div>
          {requests.map((request) => (
            <Card key={request.id} className="admin-page__request-card">
              <div>
                <strong>{request.company_name}</strong>
                <small>
                  {request.billing_interval === "year" ? "Annuel" : "Mensuel"}
                  {" · "}
                  {(request.amount_cents / 100).toLocaleString("fr-BE", {
                    style: "currency",
                    currency: request.currency,
                  })}
                  {request.setup_fee_cents > 0
                    ? ` + ${(request.setup_fee_cents / 100).toLocaleString("fr-BE", { style: "currency", currency: request.currency })} de configuration`
                    : " · configuration offerte"}
                  {request.promo_code ? ` · Code ${request.promo_code}` : ""}
                </small>
                <small>Demandé le {formatDisplayDate(request.requested_at)}</small>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => openActivation(request.company_id, request.price_id)}
              >
                Activer
              </Button>
            </Card>
          ))}
        </div>
      ) : null}

      {data.subscriptions?.length ? (
        <Card className="admin-page__table-wrap">
          <table>
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Formule</th>
                <th>Fréquence</th>
                <th>Statut</th>
                <th>Échéance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td className="admin-page__cell--primary" data-label="Entreprise"><strong>{subscription.company_name}</strong></td>
                  <td data-label="Formule">{subscription.plan_name}</td>
                  <td data-label="Fréquence">
                    {subscription.billing_interval === "year" ? "Annuelle" : "Mensuelle"}
                  </td>
                  <td data-label="Statut"><span className="admin-page__status">{subscription.status}</span></td>
                  <td data-label="Échéance">
                    {subscription.current_period_end
                      ? formatDisplayDate(subscription.current_period_end)
                      : "Accès permanent"}
                  </td>
                  <td className="admin-page__cell--action" data-label="Action">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        openActivation(subscription.company_id, subscription.price_id)
                      }
                    >
                      Renouveler
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <EmptyState
          title="Aucun abonnement"
          description="Activez le premier compte ou attendez une demande client."
        />
      )}

      <Drawer
        open={drawerOpen}
        title="Activer un abonnement"
        description="L’accès aux devis est ouvert immédiatement pour la période choisie."
        onClose={() => setDrawerOpen(false)}
      >
        <form className="admin-page__form" onSubmit={activateSubscription}>
          <FormField label="Entreprise">
            <Select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">Sélectionner une entreprise</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Fréquence et prix">
            <Select value={priceId} onChange={(event) => setPriceId(event.target.value)}>
              <option value="">Sélectionner une offre</option>
              {prices.map((price) => (
                <option key={price.id} value={price.id}>
                  {price.plan_name} · {price.billing_interval === "year" ? "Annuel" : "Mensuel"} · {(price.amount_cents / 100).toLocaleString("fr-BE", { style: "currency", currency: price.currency })} HT{price.setup_fee_cents > 0 ? ` + ${(price.setup_fee_cents / 100).toLocaleString("fr-BE", { style: "currency", currency: price.currency })} de configuration` : " · configuration offerte"}
                </option>
              ))}
            </Select>
          </FormField>
          {error ? <ErrorMessage message={error} /> : null}
          <div className="admin-page__form-actions">
            <Button type="submit" disabled={saving || !companyId || !priceId}>
              {saving ? "Activation..." : "Activer maintenant"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDrawerOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

function Designs({ data, onChanged }: { data: AdminConsoleData; onChanged: () => Promise<void> }) {
  const [managedDesignId, setManagedDesignId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const managedDesign = data.designs?.find((design) => design.id === managedDesignId) ?? null;
  const assignments = (data.designAssignments ?? []).filter((assignment) => assignment.design_id === managedDesignId && assignment.enabled);

  async function execute(action: string, payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await runAdminAction(action, payload);
      await onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDesign(id: string, active: boolean) {
    await execute("set_design_active", { design_id: id, active });
  }

  async function assignDesign() {
    if (!managedDesignId || !companyId) return;
    await execute("assign_design", { design_id: managedDesignId, company_id: companyId });
    setCompanyId("");
  }

  if (!data.designs?.length) return <EmptyState title="Aucun modèle" description="Créez le premier modèle de devis de la plateforme." />;
  return (
    <>
      <div className="admin-page__designs">
        {data.designs.map((design) => (
          <Card key={design.id}>
            <div className={`admin-page__design-preview admin-page__design-preview--${design.renderer_key}`} aria-hidden="true"><span /><span /><span /></div>
            <span className="admin-page__design-visibility">{design.visibility === "private" ? "Privé" : "Public"}</span>
            <h2>{design.name}</h2>
            <p>{design.description || `${design.assigned_companies} entreprise(s) assignée(s)`}</p>
            <div className="admin-page__card-actions">
              <Button type="button" onClick={() => { setManagedDesignId(design.id); setError(null); }}>Gérer les accès</Button>
              <Button type="button" variant="secondary" onClick={() => void toggleDesign(design.id, !design.active)} disabled={saving}>{design.active ? "Désactiver" : "Activer"}</Button>
            </div>
          </Card>
        ))}
      </div>

      <Drawer open={Boolean(managedDesign)} title={managedDesign ? `Accès — ${managedDesign.name}` : "Accès au modèle"} description="Assignez le modèle et choisissez le modèle par défaut de chaque entreprise." onClose={() => setManagedDesignId(null)}>
        {error ? <ErrorMessage message={error} /> : null}
        <div className="admin-page__assignment-form">
          <FormField label="Ajouter une entreprise">
            <Select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
              <option value="">Sélectionner une entreprise</option>
              {(data.companies ?? []).filter((company) => !assignments.some((assignment) => assignment.company_id === company.id)).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
            </Select>
          </FormField>
          <Button type="button" onClick={() => void assignDesign()} disabled={!companyId || saving}>Assigner</Button>
        </div>
        <div className="admin-page__assignment-list">
          {assignments.length ? assignments.map((assignment) => {
            const company = data.companies?.find((candidate) => candidate.id === assignment.company_id);
            const isDefault = data.designPreferences?.some((preference) => preference.company_id === assignment.company_id && preference.default_design_id === managedDesignId);
            return (
              <Card key={assignment.company_id}>
                <div><strong>{company?.name ?? "Entreprise inconnue"}</strong><small>{isDefault ? "Modèle par défaut" : "Modèle disponible"}</small></div>
                <div className="admin-page__assignment-actions">
                  {!isDefault ? <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void execute("set_default_design", { design_id: managedDesignId, company_id: assignment.company_id })}>Définir par défaut</Button> : null}
                  {!isDefault ? <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void execute("unassign_design", { design_id: managedDesignId, company_id: assignment.company_id })}>Retirer</Button> : null}
                </div>
              </Card>
            );
          }) : <EmptyState title="Aucune entreprise assignée" description="Ce modèle privé n’est disponible pour aucun compte pour le moment." />}
        </div>
      </Drawer>
    </>
  );
}

function Promotions({ data, onChanged }: { data: AdminConsoleData; onChanged: () => Promise<void> }) {
  const [savingId, setSavingId] = useState<string | null>(null);
  async function togglePromotion(id: string, active: boolean) {
    setSavingId(id);
    await runAdminAction("set_promotion_active", { promotion_id: id, active });
    await onChanged();
    setSavingId(null);
  }
  if (!data.promotions?.length) return <EmptyState title="Aucun code promotionnel" description="Créez un code avec une remise et une période de validité." />;
  return (
    <Card className="admin-page__table-wrap">
      <table>
        <thead><tr><th>Code</th><th>Remise</th><th>Période</th><th>Utilisations</th><th>Statut</th><th>Action</th></tr></thead>
        <tbody>
          {data.promotions.map((promotion) => (
            <tr key={promotion.id}>
              <td className="admin-page__cell--primary" data-label="Code"><strong>{promotion.code}</strong></td>
              <td data-label="Remise">{promotion.discount_label}</td>
              <td data-label="Période">{formatDisplayDate(promotion.starts_at)} → {formatDisplayDate(promotion.ends_at)}</td>
              <td data-label="Utilisations">{promotion.redemption_count}{promotion.max_redemptions ? ` / ${promotion.max_redemptions}` : ""}</td>
              <td data-label="Statut"><span className="admin-page__status">{promotion.active ? "Actif" : "Inactif"}</span></td>
              <td className="admin-page__cell--action" data-label="Action"><Button type="button" size="sm" variant="secondary" disabled={savingId === promotion.id} onClick={() => void togglePromotion(promotion.id, !promotion.active)}>{promotion.active ? "Désactiver" : "Activer"}</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
