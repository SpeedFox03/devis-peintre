import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { Drawer } from "../../../components/ui/Drawer/Drawer";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { PlusIcon, ProjectIcon } from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Select } from "../../../components/ui/Select/Select";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { env } from "../../../lib/env";
import { formatDisplayDate } from "../../../lib/formatters";
import { createProject, listCompaniesForProjects, listProjectCustomers, listProjects } from "../projectRepository";
import type { Project, ProjectCustomer, ProjectStatus } from "../types";
import { getProjectCustomerName, getProjectStatusLabel } from "../types";
import "./ProjectsPage.css";

type ProjectForm = {
  company_id: string;
  customer_id: string;
  name: string;
  status: ProjectStatus;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  start_date: string;
  notes: string;
};

const emptyForm: ProjectForm = {
  company_id: "",
  customer_id: "",
  name: "",
  status: "lead",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country: "Belgique",
  start_date: "",
  notes: "",
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(env.projectsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | ProjectStatus>("active");
  const [form, setForm] = useState<ProjectForm>(emptyForm);

  useEffect(() => {
    if (!env.projectsEnabled) return;
    let cancelled = false;
    async function loadPage() {
      try {
        const [loadedProjects, loadedCustomers, loadedCompanies] = await Promise.all([
          listProjects(),
          listProjectCustomers(),
          listCompaniesForProjects(),
        ]);
        if (cancelled) return;
        setProjects(loadedProjects);
        setCustomers(loadedCustomers);
        setCompanies(loadedCompanies);
        setForm((current) => ({ ...current, company_id: loadedCompanies[0]?.id ?? "" }));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPage();
    return () => { cancelled = true; };
  }, []);

  const customersById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (statusFilter === "active" && project.status === "archived") return false;
      if (statusFilter !== "active" && project.status !== statusFilter) return false;
      const customerName = getProjectCustomerName(customersById.get(project.customer_id));
      return !query || [project.name, project.city, customerName].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [customersById, projects, search, statusFilter]);

  function updateField<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.company_id || !form.customer_id || !form.name.trim()) {
      setError("Entreprise, client et nom du projet sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const project = await createProject({
        company_id: form.company_id,
        customer_id: form.customer_id,
        name: form.name.trim(),
        status: form.status,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || "Belgique",
        start_date: form.start_date || null,
        notes: form.notes.trim() || null,
      });
      setProjects((current) => [project, ...current]);
      setForm({ ...emptyForm, company_id: companies[0]?.id ?? "" });
      setDrawerOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock message="Chargement des projets..." />;

  return (
    <section className="projects-page">
      <header className="projects-page__header">
        <div>
          <p className="projects-page__eyebrow">Suivi des chantiers</p>
          <h1>Projets</h1>
          <p>Un espace par chantier pour réunir le client, l’adresse, les devis et les photos.</p>
        </div>
        <Button type="button" onClick={() => setDrawerOpen(true)} disabled={!env.projectsEnabled}>
          <PlusIcon /> Nouveau projet
        </Button>
      </header>

      {!env.projectsEnabled ? (
        <Card className="projects-page__empty">
          <span className="projects-page__empty-icon"><ProjectIcon /></span>
          <div>
            <h2>Interface prête, activation différée</h2>
            <p>Les tables Projets seront ajoutées lors de la migration finale. Aucun appel n’est envoyé à la base actuelle.</p>
          </div>
          <Link to="/clients">Consulter les clients</Link>
        </Card>
      ) : (
        <>
          <div className="projects-page__summary">
            <Card><span>Projets actifs</span><strong>{projects.filter((project) => project.status !== "archived" && project.status !== "completed").length}</strong></Card>
            <Card><span>Chantiers en cours</span><strong>{projects.filter((project) => project.status === "in_progress").length}</strong></Card>
          </div>

          <Card className="projects-page__filters">
            <FormField label="Recherche"><TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Projet, client ou ville" /></FormField>
            <FormField label="Statut">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                <option value="active">Tous les projets actifs</option>
                <option value="lead">À qualifier</option>
                <option value="planned">Planifiés</option>
                <option value="in_progress">En cours</option>
                <option value="completed">Terminés</option>
                <option value="archived">Archivés</option>
              </Select>
            </FormField>
          </Card>

          {error ? <ErrorMessage message={error} /> : null}
          {filteredProjects.length === 0 ? (
            <EmptyState title="Aucun projet" description="Créez un premier projet depuis un client ou avec le bouton ci-dessus." actionLabel="Nouveau projet" onAction={() => setDrawerOpen(true)} />
          ) : (
            <div className="projects-page__list">
              {filteredProjects.map((project) => (
                <Link key={project.id} to={`/projets/${project.id}`} className="projects-page__card">
                  <span className={`projects-page__status projects-page__status--${project.status}`}>{getProjectStatusLabel(project.status)}</span>
                  <span className="projects-page__card-copy"><strong>{project.name}</strong><small>{getProjectCustomerName(customersById.get(project.customer_id))}</small></span>
                  <span className="projects-page__card-meta"><strong>{project.city || "Adresse à compléter"}</strong><small>Mis à jour le {formatDisplayDate(project.updated_at)}</small></span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <Drawer open={drawerOpen} title="Nouveau projet" description="Créez le dossier du chantier avant son premier devis." onClose={() => setDrawerOpen(false)}>
        <form id="create-project-form" className="projects-page__form" onSubmit={handleSubmit}>
          <FormField label="Entreprise"><Select value={form.company_id} onChange={(event) => updateField("company_id", event.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></FormField>
          <FormField label="Client"><Select value={form.customer_id} onChange={(event) => updateField("customer_id", event.target.value)}><option value="">Sélectionner un client</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{getProjectCustomerName(customer)}</option>)}</Select></FormField>
          <FormField label="Nom du projet"><TextInput value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Rénovation appartement Louise" /></FormField>
          <FormGrid columns="2">
            <FormField label="Statut"><Select value={form.status} onChange={(event) => updateField("status", event.target.value as ProjectStatus)}><option value="lead">À qualifier</option><option value="planned">Planifié</option><option value="in_progress">En cours</option></Select></FormField>
            <FormField label="Début prévu"><TextInput type="date" value={form.start_date} onChange={(event) => updateField("start_date", event.target.value)} /></FormField>
          </FormGrid>
          <FormField label="Adresse du chantier"><TextInput value={form.address_line1} onChange={(event) => updateField("address_line1", event.target.value)} /></FormField>
          <FormGrid columns="2"><FormField label="Code postal"><TextInput value={form.postal_code} onChange={(event) => updateField("postal_code", event.target.value)} /></FormField><FormField label="Ville"><TextInput value={form.city} onChange={(event) => updateField("city", event.target.value)} /></FormField></FormGrid>
          <FormField label="Notes"><TextArea rows={4} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></FormField>
          {error ? <ErrorMessage message={error} /> : null}
          <div className="projects-page__form-actions"><Button type="submit" disabled={saving}>{saving ? "Création..." : "Créer le projet"}</Button><Button type="button" variant="secondary" onClick={() => setDrawerOpen(false)}>Annuler</Button></div>
        </form>
      </Drawer>
    </section>
  );
}
