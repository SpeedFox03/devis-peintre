import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { Card } from "../../../../components/ui/Card/Card";
import { EmptyState } from "../../../../components/ui/EmptyState/EmptyState";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { Select } from "../../../../components/ui/Select/Select";
import { QuoteRoomForm } from "../QuoteRoomForm/QuoteRoomForm";
import type {
  QuoteItem,
  Room,
  RoomFormState,
  RoomPhoto,
  RoomPhotoWithUrl,
  RoomTemplate,
} from "../../types";
import {
  CatalogIcon,
  EyeIcon,
  ImageIcon,
  PlusIcon,
  CloseIcon,
  CopyIcon,
  TrashIcon,
} from "../../../../components/ui/Icons/AppIcons";
import { formatDisplayDate } from "../../../../lib/formatters";
import "./QuoteRoomsSection.css";

type QuoteRoomsSectionProps = {
  rooms: Room[];
  roomTemplates: RoomTemplate[];
  items: QuoteItem[];
  roomPhotos: RoomPhoto[];
  showForm: boolean;
  form: RoomFormState;
  saving: boolean;
  error: string | null;
  deletingRoomId: string | null;
  duplicatingRoomId: string | null;
  savingRoomTemplateId: string | null;
  insertingRoomTemplateId: string | null;
  uploadingPhotoRoomId: string | null;
  deletingPhotoId: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: <K extends keyof RoomFormState>(field: K, value: RoomFormState[K]) => void;
  onDelete: (roomId: string) => void;
  onDuplicate: (roomId: string) => void;
  onSaveTemplate: (roomId: string) => void;
  onInsertTemplate: (templateId: string) => void;
  onUploadPhotos: (roomId: string, files: File[]) => Promise<boolean>;
  onLoadGallery: (roomId: string) => Promise<RoomPhotoWithUrl[]>;
  onDeletePhoto: (photo: RoomPhoto) => Promise<boolean>;
};

function getRoomItemsCount(roomId: string, items: QuoteItem[]) {
  return items.filter((item) => item.room_id === roomId).length;
}

function getRoomPhotosCount(roomId: string, photos: RoomPhoto[]) {
  return photos.filter((photo) => photo.room_id === roomId).length;
}

export function QuoteRoomsSection({
  rooms,
  roomTemplates,
  items,
  roomPhotos,
  showForm,
  form,
  saving,
  error,
  deletingRoomId,
  duplicatingRoomId,
  savingRoomTemplateId,
  insertingRoomTemplateId,
  uploadingPhotoRoomId,
  deletingPhotoId,
  onOpenForm,
  onCloseForm,
  onSubmit,
  onChange,
  onDelete,
  onDuplicate,
  onSaveTemplate,
  onInsertTemplate,
  onUploadPhotos,
  onLoadGallery,
  onDeletePhoto,
}: QuoteRoomsSectionProps) {
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});
  const galleryDialogRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const [galleryRoom, setGalleryRoom] = useState<Room | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<RoomPhotoWithUrl[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [galleryLoadFailed, setGalleryLoadFailed] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    if (!galleryRoom) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    galleryDialogRef.current?.focus();

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setGalleryRoom(null);
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [galleryRoom]);

  async function openGallery(room: Room) {
    setGalleryRoom(room);
    setGalleryPhotos([]);
    setActivePhotoIndex(0);
    setLoadingGallery(true);
    setGalleryLoadFailed(false);

    const loadedPhotos = await onLoadGallery(room.id);
    setGalleryPhotos(loadedPhotos);
    setGalleryLoadFailed(
      loadedPhotos.length === 0 && getRoomPhotosCount(room.id, roomPhotos) > 0,
    );
    setLoadingGallery(false);
  }

  async function handlePhotoSelection(roomId: string, files: FileList | null) {
    if (!files?.length) return;
    const uploaded = await onUploadPhotos(roomId, Array.from(files));

    const input = fileInputsRef.current[roomId];
    if (input) input.value = "";

    if (uploaded && galleryRoom?.id === roomId) {
      setLoadingGallery(true);
      const loadedPhotos = await onLoadGallery(roomId);
      setGalleryPhotos(loadedPhotos);
      setActivePhotoIndex(Math.max(0, loadedPhotos.length - 1));
      setGalleryLoadFailed(false);
      setLoadingGallery(false);
    }
  }

  function showPreviousPhoto() {
    if (galleryPhotos.length < 2) return;
    setActivePhotoIndex(
      (current) => (current - 1 + galleryPhotos.length) % galleryPhotos.length,
    );
  }

  function showNextPhoto() {
    if (galleryPhotos.length < 2) return;
    setActivePhotoIndex((current) => (current + 1) % galleryPhotos.length);
  }

  async function deleteActivePhoto() {
    const photo = galleryPhotos[activePhotoIndex];
    if (!photo) return;

    const deleted = await onDeletePhoto(photo);
    if (!deleted) return;

    setGalleryPhotos((current) => current.filter((item) => item.id !== photo.id));
    setActivePhotoIndex((current) =>
      Math.max(0, Math.min(current, galleryPhotos.length - 2)),
    );
  }

  const activePhoto = galleryPhotos[activePhotoIndex] ?? null;
  const roomsWithNotes = rooms.filter((room) => room.notes?.trim());
  const effectiveTemplateId = roomTemplates.some(
    (template) => template.id === selectedTemplateId,
  )
    ? selectedTemplateId
    : (roomTemplates[0]?.id ?? "");

  return (
    <section className="quote-rooms-premium">
      <Card className="quote-rooms-premium__shell">
        <div className="quote-rooms-premium__header">
          <div>
            <h2 className="quote-rooms-premium__title">Pièces</h2>
          </div>

          <div className="quote-rooms-premium__header-actions">
            {!showForm ? (
              <Button
                type="button"
                onClick={onOpenForm}
                iconOnly
                aria-label="Ajouter une pièce"
                title="Ajouter une pièce"
              >
                <PlusIcon />
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={onCloseForm}
                iconOnly
                aria-label="Fermer"
                title="Fermer"
              >
                <CloseIcon />
              </Button>
            )}
          </div>
        </div>

        {showForm ? (
          <div className="quote-rooms-premium__form-box">
            <QuoteRoomForm
              form={form}
              error={error}
              saving={saving}
              onSubmit={onSubmit}
              onCancel={onCloseForm}
              onChange={onChange}
            />
          </div>
        ) : null}

        {!showForm && error ? <ErrorMessage message={error} /> : null}

        <section
          className="quote-rooms-premium__templates"
          aria-labelledby="quote-room-templates-title"
        >
          <div className="quote-rooms-premium__templates-copy">
            <h3 id="quote-room-templates-title">Modèles de pièces</h3>
            <p>
              Réutilisez une pièce complète avec ses lignes, ses notes et sa
              pagination. Les photos restent propres à chaque devis.
            </p>
          </div>

          {roomTemplates.length > 0 ? (
            <div className="quote-rooms-premium__template-controls">
              <Select
                value={effectiveTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                aria-label="Modèle de pièce à ajouter"
              >
                {roomTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} — {template.room_name}
                  </option>
                ))}
              </Select>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={
                  !effectiveTemplateId ||
                  insertingRoomTemplateId !== null ||
                  savingRoomTemplateId !== null
                }
                onClick={() => onInsertTemplate(effectiveTemplateId)}
              >
                <PlusIcon />
                {insertingRoomTemplateId === effectiveTemplateId
                  ? "Ajout..."
                  : "Ajouter au devis"}
              </Button>
            </div>
          ) : (
            <p className="quote-rooms-premium__templates-empty">
              Aucun modèle enregistré. Utilisez « Créer un modèle » sur une
              pièce existante.
            </p>
          )}
        </section>

        {rooms.length === 0 ? (
          <EmptyState
            title="Aucune pièce ajoutée"
            description=""
            actionLabel="Ajouter une pièce"
            onAction={onOpenForm}
          />
        ) : (
          <>
            <div className="quote-rooms-premium__grid">
              {rooms.map((room) => {
                const lineCount = getRoomItemsCount(room.id, items);
                const photoCount = getRoomPhotosCount(room.id, roomPhotos);
                const uploading = uploadingPhotoRoomId === room.id;

                return (
                  <article key={room.id} className="quote-rooms-premium__card">
                    <div className="quote-rooms-premium__card-top">
                      <div className="quote-rooms-premium__card-main">
                        <h3 className="quote-rooms-premium__card-title">{room.name}</h3>
                      </div>

                      <div className="quote-rooms-premium__badges">
                        <span className="quote-rooms-premium__badge">
                          {lineCount === 0
                            ? "Aucune ligne"
                            : `${lineCount} ligne${lineCount > 1 ? "s" : ""}`}
                        </span>
                        <span className="quote-rooms-premium__badge quote-rooms-premium__badge--photos">
                          {photoCount} photo{photoCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <input
                      ref={(input) => {
                        fileInputsRef.current[room.id] = input;
                      }}
                      className="quote-rooms-premium__file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(event) =>
                        void handlePhotoSelection(room.id, event.currentTarget.files)
                      }
                      tabIndex={-1}
                    />

                    <div className="quote-rooms-premium__card-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={uploading}
                        onClick={() => fileInputsRef.current[room.id]?.click()}
                      >
                        <ImageIcon />
                        {uploading ? "Import..." : "Ajouter"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={photoCount === 0 || uploading}
                        onClick={() => void openGallery(room)}
                      >
                        <EyeIcon />
                        Galerie ({photoCount})
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={duplicatingRoomId !== null}
                        onClick={() => onDuplicate(room.id)}
                        title="Dupliquer la pièce avec toutes ses lignes, sans les photos"
                      >
                        <CopyIcon />
                        {duplicatingRoomId === room.id
                          ? "Duplication..."
                          : "Dupliquer"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={
                          savingRoomTemplateId !== null ||
                          insertingRoomTemplateId !== null
                        }
                        onClick={() => onSaveTemplate(room.id)}
                        title="Enregistrer la pièce et ses lignes comme modèle, sans les photos"
                      >
                        <CatalogIcon />
                        {savingRoomTemplateId === room.id
                          ? "Enregistrement..."
                          : "Créer un modèle"}
                      </Button>

                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={deletingRoomId === room.id}
                        onClick={() => onDelete(room.id)}
                      >
                        <TrashIcon />
                        {deletingRoomId === room.id ? "Suppression..." : "Supprimer"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {roomsWithNotes.length > 0 ? (
              <aside
                className="quote-rooms-premium__notes"
                aria-labelledby="quote-room-notes-title"
              >
                <div className="quote-rooms-premium__notes-header">
                  <h3 id="quote-room-notes-title">Notes des pièces</h3>
                  <span>Usage interne — non affichées sur le devis</span>
                </div>

                <div className="quote-rooms-premium__notes-list">
                  {roomsWithNotes.map((room) => (
                    <article key={room.id} className="quote-rooms-premium__note">
                      <h4>{room.name}</h4>
                      <p>{room.notes?.trim()}</p>
                    </article>
                  ))}
                </div>
              </aside>
            ) : null}
          </>
        )}
      </Card>

      {galleryRoom ? (
        <div
          className="quote-room-gallery__backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGalleryRoom(null);
          }}
        >
          <div
            ref={galleryDialogRef}
            className="quote-room-gallery"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quote-room-gallery-title"
            tabIndex={-1}
          >
            <header className="quote-room-gallery__header">
              <div>
                <p className="quote-room-gallery__eyebrow">Galerie de la pièce</p>
                <h3 id="quote-room-gallery-title" className="quote-room-gallery__title">
                  {galleryRoom.name}
                </h3>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconOnly
                onClick={() => setGalleryRoom(null)}
                aria-label="Fermer la galerie"
                title="Fermer la galerie"
              >
                <CloseIcon />
              </Button>
            </header>

            {loadingGallery ? (
              <div className="quote-room-gallery__status" role="status">
                Chargement des photos...
              </div>
            ) : activePhoto ? (
              <>
                <div className="quote-room-gallery__viewer">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="quote-room-gallery__nav"
                    iconOnly
                    disabled={galleryPhotos.length < 2}
                    onClick={showPreviousPhoto}
                    aria-label="Photo précédente"
                  >
                    ‹
                  </Button>

                  <figure
                    className="quote-room-gallery__figure"
                    onTouchStart={(event) => {
                      touchStartXRef.current = event.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                      const touchStartX = touchStartXRef.current;
                      const touchEndX = event.changedTouches[0]?.clientX;
                      touchStartXRef.current = null;
                      if (touchStartX === null || touchEndX === undefined) return;
                      const distance = touchEndX - touchStartX;
                      if (Math.abs(distance) < 45) return;
                      if (distance > 0) showPreviousPhoto();
                      else showNextPhoto();
                    }}
                  >
                    <img
                      className="quote-room-gallery__image"
                      src={activePhoto.signed_url}
                      alt={
                        activePhoto.caption ||
                        activePhoto.original_name ||
                        `Photo ${activePhotoIndex + 1}`
                      }
                    />
                  </figure>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="quote-room-gallery__nav"
                    iconOnly
                    disabled={galleryPhotos.length < 2}
                    onClick={showNextPhoto}
                    aria-label="Photo suivante"
                  >
                    ›
                  </Button>
                </div>

                <div className="quote-room-gallery__meta">
                  <div>
                    <p className="quote-room-gallery__counter">
                      Photo {activePhotoIndex + 1} sur {galleryPhotos.length}
                      {` · ${formatDisplayDate(activePhoto.created_at)}`}
                    </p>
                    <p className="quote-room-gallery__filename">
                      {activePhoto.original_name || "Photo sans nom"}
                    </p>
                  </div>

                  <div className="quote-room-gallery__meta-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={uploadingPhotoRoomId === galleryRoom.id}
                      onClick={() => fileInputsRef.current[galleryRoom.id]?.click()}
                    >
                      <ImageIcon />
                      {uploadingPhotoRoomId === galleryRoom.id ? "Import..." : "Ajouter"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={deletingPhotoId === activePhoto.id}
                      onClick={() => void deleteActivePhoto()}
                    >
                      <TrashIcon />
                      {deletingPhotoId === activePhoto.id ? "Suppression..." : "Supprimer"}
                    </Button>
                  </div>
                </div>

                {galleryPhotos.length > 1 ? (
                  <div className="quote-room-gallery__thumbnails" aria-label="Miniatures">
                    {galleryPhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        className={`quote-room-gallery__thumbnail ${
                          index === activePhotoIndex
                            ? "quote-room-gallery__thumbnail--active"
                            : ""
                        }`}
                        onClick={() => setActivePhotoIndex(index)}
                        aria-label={`Afficher la photo ${index + 1}`}
                        aria-current={index === activePhotoIndex ? "true" : undefined}
                      >
                        <img
                          src={photo.signed_url}
                          alt=""
                          className="quote-room-gallery__thumbnail-image"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="quote-room-gallery__status">
                {galleryLoadFailed
                  ? "Impossible de charger les photos. Réessayez dans quelques instants."
                  : "Aucune photo disponible dans cette pièce."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
