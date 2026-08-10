import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { PlusIcon, ProjectIcon } from "../../../components/ui/Icons/AppIcons";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { env } from "../../../lib/env";
import { formatDisplayDate } from "../../../lib/formatters";
import { supabase } from "../../../lib/supabase";
import { getProject, listProjectCustomers, updateProjectStatus } from "../projectRepository";
import type { Project, ProjectCustomer, ProjectStatus } from "../types";
import { getProjectCustomerName, getProjectStatusLabel } from "../types";
import "./ProjectDetailsPage.css";

type ProjectQuote = {
  id: string;
  quote_number: string;
  title: string;
  status: string;
  total_ttc: number;
  created_at: string;
};

type ProjectPhoto = {
  id: string;
  storage_path: string;
  original_name: string | null;
  caption: string | null;
  created_at: string;
  signed_url: string | null;
};

const PROJECT_PHOTOS_BUCKET = "project-photos";
const PROJECT_PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const nextStatus: Partial<Record<ProjectStatus, ProjectStatus>> = {
  lead: "planned",
  planned: "in_progress",
  in_progress: "completed",
};

const nextStatusLabel: Partial<Record<ProjectStatus, string>> = {
  lead: "Planifier le projet",
  planned: "Démarrer le chantier",
  in_progress: "Marquer comme terminé",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format(value || 0);
}

export function ProjectDetailsPage() {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<ProjectCustomer | null>(null);
  const [quotes, setQuotes] = useState<ProjectQuote[]>([]);
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [loading, setLoading] = useState(env.projectsEnabled);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!env.projectsEnabled || !projectId) return;
    let cancelled = false;
    async function loadPage() {
      try {
        const [loadedProject, loadedCustomers, quotesResult, photosResult] = await Promise.all([
          getProject(projectId as string),
          listProjectCustomers(),
          supabase
            .from("quotes")
            .select("id, quote_number, title, status, total_ttc, created_at")
            .eq("project_id", projectId)
            .order("created_at", { ascending: false }),
          supabase
            .from("project_photos")
            .select("id, storage_path, original_name, caption, created_at")
            .eq("project_id", projectId)
            .order("sort_order")
            .order("created_at"),
        ]);
        if (cancelled) return;
        if (quotesResult.error) throw quotesResult.error;
        if (photosResult.error) throw photosResult.error;
        const photoRows = (photosResult.data ?? []) as Omit<ProjectPhoto, "signed_url">[];
        const { data: signedPhotos, error: signedPhotosError } = photoRows.length
          ? await supabase.storage.from(PROJECT_PHOTOS_BUCKET).createSignedUrls(photoRows.map((photo) => photo.storage_path), 3600)
          : { data: [], error: null };
        if (signedPhotosError) throw signedPhotosError;
        const signedUrls = new Map((signedPhotos ?? []).map((photo) => [photo.path, photo.signedUrl]));
        setProject(loadedProject);
        setCustomer(loadedCustomers.find((item) => item.id === loadedProject.customer_id) ?? null);
        setQuotes((quotesResult.data ?? []) as ProjectQuote[]);
        setPhotos(photoRows.map((photo) => ({ ...photo, signed_url: signedUrls.get(photo.storage_path) ?? null })));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Projet introuvable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPage();
    return () => { cancelled = true; };
  }, [projectId]);

  async function advanceProject() {
    if (!project || !nextStatus[project.status]) return;
    const status = nextStatus[project.status] as ProjectStatus;
    setSaving(true);
    setError(null);
    try {
      await updateProjectStatus(project.id, status);
      setProject((current) => current ? { ...current, status } : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Mise à jour impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadProjectPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!project || selectedFiles.length === 0) return;
    setUploadingPhotos(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw authError ?? new Error("Utilisateur non connecté.");
      for (const [index, file] of selectedFiles.entries()) {
        const extension = PROJECT_PHOTO_TYPES.get(file.type);
        if (!extension) throw new Error("Seules les images JPG, PNG et WebP sont acceptées.");
        if (file.size > 12 * 1024 * 1024) throw new Error("Chaque photo doit peser moins de 12 Mo.");
        const storagePath = `${project.company_id}/${project.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(PROJECT_PHOTOS_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { data: insertedPhoto, error: metadataError } = await supabase
          .from("project_photos")
          .insert({
            company_id: project.company_id,
            project_id: project.id,
            storage_path: storagePath,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            sort_order: photos.length + index,
            uploaded_by: authData.user.id,
          })
          .select("id, storage_path, original_name, caption, created_at")
          .single();
        if (metadataError || !insertedPhoto) {
          await supabase.storage.from(PROJECT_PHOTOS_BUCKET).remove([storagePath]);
          throw metadataError ?? new Error("La photo n’a pas pu être enregistrée.");
        }
        const { data: signedPhoto, error: signedPhotoError } = await supabase.storage.from(PROJECT_PHOTOS_BUCKET).createSignedUrl(storagePath, 3600);
        if (signedPhotoError) throw signedPhotoError;
        setPhotos((current) => [...current, { ...(insertedPhoto as Omit<ProjectPhoto, "signed_url">), signed_url: signedPhoto.signedUrl }]);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Ajout des photos impossible.");
    } finally {
      setUploadingPhotos(false);
    }
  }

  if (!env.projectsEnabled) {
    return (
      <EmptyState
        title="Projets en attente d’activation"
        description="Cette fiche sera disponible après la migration finale, sans modification préalable de la base actuelle."
      />
    );
  }
  if (loading) return <LoadingBlock message="Chargement du projet..." />;
  if (error && !project) return <ErrorMessage message={error} />;
  if (!project) return <EmptyState title="Projet introuvable" description="Ce projet n’existe pas ou n’est pas accessible." />;

  const address = [project.address_line1, project.address_line2, [project.postal_code, project.city].filter(Boolean).join(" "), project.country]
    .filter(Boolean)
    .join(", ");

  return (
    <section className="project-details-page">
      <header className="project-details-page__header">
        <div>
          <Link to="/projets" className="project-details-page__back">← Tous les projets</Link>
          <div className="project-details-page__title-row">
            <h1>{project.name}</h1>
            <span className={`projects-page__status projects-page__status--${project.status}`}>{getProjectStatusLabel(project.status)}</span>
          </div>
          <p>{getProjectCustomerName(customer ?? undefined)} · {project.city || "Adresse à compléter"}</p>
        </div>
        <div className="project-details-page__actions">
          <Link to={`/devis?new=1&customerId=${project.customer_id}&projectId=${project.id}`} className="project-details-page__button-link"><PlusIcon /> Nouveau devis</Link>
          {nextStatus[project.status] ? <Button type="button" onClick={advanceProject} disabled={saving}>{saving ? "Mise à jour..." : nextStatusLabel[project.status]}</Button> : null}
        </div>
      </header>

      {error ? <ErrorMessage message={error} /> : null}

      <div className="project-details-page__grid">
        <Card className="project-details-page__main-card">
          <div className="project-details-page__section-title"><ProjectIcon /><div><p>Dossier chantier</p><h2>Informations</h2></div></div>
          <dl className="project-details-page__info">
            <div><dt>Client</dt><dd><Link to={`/clients/${project.customer_id}`}>{getProjectCustomerName(customer ?? undefined)}</Link></dd></div>
            <div><dt>Adresse du chantier</dt><dd>{address || "À compléter"}</dd></div>
            <div><dt>Début prévu</dt><dd>{project.start_date ? formatDisplayDate(project.start_date) : "Non planifié"}</dd></div>
            <div><dt>Notes</dt><dd>{project.notes || "Aucune note"}</dd></div>
          </dl>
        </Card>

        <Card className="project-details-page__quotes-card">
          <div className="project-details-page__section-header"><div><p>Commercial</p><h2>Devis du projet</h2></div><span>{quotes.length}</span></div>
          {quotes.length === 0 ? <p className="project-details-page__muted">Aucun devis lié à ce projet.</p> : (
            <div className="project-details-page__quote-list">
              {quotes.map((quote) => (
                <Link key={quote.id} to={`/devis/${quote.id}`}>
                  <span><strong>{quote.title}</strong><small>{quote.quote_number} · {formatDisplayDate(quote.created_at)}</small></span>
                  <strong>{formatCurrency(quote.total_ttc)}</strong>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="project-details-page__photos-card">
          <div className="project-details-page__section-header">
            <div><p>Suivi visuel</p><h2>Photos du chantier</h2></div>
            <label className={`project-details-page__upload${uploadingPhotos ? " project-details-page__upload--disabled" : ""}`}>
              <PlusIcon /> {uploadingPhotos ? "Ajout..." : "Ajouter"}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploadingPhotos} onChange={(event) => void uploadProjectPhotos(event)} />
            </label>
          </div>
          {photos.length === 0 ? <p className="project-details-page__muted">Aucune photo. Ajoutez les premières vues du chantier depuis votre téléphone.</p> : (
            <div className="project-details-page__photo-grid">
              {photos.map((photo) => photo.signed_url ? <figure key={photo.id}><img src={photo.signed_url} alt={photo.caption || photo.original_name || "Photo du chantier"} loading="lazy" /><figcaption>{photo.caption || photo.original_name || "Photo du chantier"}</figcaption></figure> : null)}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
