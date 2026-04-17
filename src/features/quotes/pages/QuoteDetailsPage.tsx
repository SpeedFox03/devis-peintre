import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { Select } from "../../../components/ui/Select/Select";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { QuoteItemsSection } from "../components/QuoteItemsSection/QuoteItemsSection";
import { QuoteRoomsSection } from "../components/QuoteRoomsSection/QuoteRoomsSection";
import { QuoteSummarySection } from "../components/QuoteSummarySection/QuoteSummarySection";
import { useQuoteDetailsPage } from "../hooks/useQuoteDetailsPage";
import { getQuoteStatusLabel, type QuoteStatus } from "../types";
import {
  DownloadIcon,
  AttachmentIcon,
} from "../../../components/ui/Icons/AppIcons";
import "./QuoteDetailsPage.css";


const quotePages = [
  {
    id: "builder",
    label: "Pièces & lignes",
  },
  {
    id: "details",
    label: "Informations",
  },
] as const;

type QuotePageId = (typeof quotePages)[number]["id"];

export function QuoteDetailsPage() {
  const [showGeneralMenu, setShowGeneralMenu] = useState(false);
  const [activePage, setActivePage] = useState<QuotePageId>("builder");
  const generalMenuRef = useRef<HTMLDivElement | null>(null);

  // Portal target: the .app-topbar element
  const [topbarPortalTarget, setTopbarPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    const topbar = document.querySelector(".app-topbar");
    setTopbarPortalTarget(topbar);

    // Mark topbar so CSS can adjust its layout
    topbar?.classList.add("app-topbar--with-quote-nav");

    return () => {
      topbar?.classList.remove("app-topbar--with-quote-nav");
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (generalMenuRef.current && !generalMenuRef.current.contains(event.target as Node)) {
        setShowGeneralMenu(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowGeneralMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const {
    quote,
    items,
    rooms,
    services,

    loading,
    savingGeneral,
    savingItem,
    savingRoom,
    deletingItemId,
    deletingRoomId,
    downloadingPdf,
    creatingInvoice,
    addingCatalogServiceId,
    movingItem,
    moveRoomId,
    movingItemLoading,

    error,
    showItemForm,
    showRoomForm,
    showCatalogPicker,
    editingItemId,

    catalogSearch,
    catalogCategory,
    catalogRoomId,

    quoteGeneralForm,
    itemForm,
    roomForm,
    roomMap,

    updateQuoteGeneralField,
    updateItemField,
    updateRoomField,

    resetQuoteGeneralForm,
    applyCompanyDefaultsToQuote,

    handleSaveQuoteGeneral,
    handleCreateInvoiceFromQuote,

    openCreateItemForm,
    openEditItemForm,
    closeItemForm,

    openRoomForm,
    closeRoomForm,

    openCatalogPicker,
    closeCatalogPicker,

    openMoveItem,
    closeMoveItem,

    handleMoveItem,
    handleAddRoom,
    handleSaveItem,
    handleAddFromCatalog,
    handleDuplicateItem,
    handleDeleteItem,
    handleDeleteRoom,
    handleDownloadPdf,

    setCatalogSearch,
    setCatalogCategory,
    setCatalogRoomId,
    setMoveRoomId,
  } = useQuoteDetailsPage();

  if (loading) {
    return <LoadingBlock message="Chargement du devis..." />;
  }

  if (error && !quote) {
    return <ErrorMessage message={error} />;
  }

  if (!quote) {
    return (
      <EmptyState
        title="Devis introuvable"
        description="Ce devis n'existe pas ou n'est pas accessible."
      />
    );
  }

  // The tab nav injected into the Topbar
  const tabNav = (
    <nav className="quote-topbar-nav" aria-label="Pages du devis">
      {quotePages.map((page) => (
        <button
          key={page.id}
          type="button"
          className={`quote-topbar-nav__tab ${
            activePage === page.id ? "quote-topbar-nav__tab--active" : ""
          }`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </button>
      ))}
    </nav>
  );

  return (
    <section className="quote-premium-page">
      {/* Inject nav into Topbar via portal */}
      {topbarPortalTarget ? createPortal(tabNav, topbarPortalTarget) : null}

      <header className="quote-premium-page__hero">
        <div className="quote-premium-page__hero-title-row">
          <div className="quote-premium-page__hero-copy">
            <h1 className="quote-premium-page__hero-title">{quote.title}</h1>

            <span
              className={`quote-premium-page__status-chip quote-premium-page__status-chip--${quote.status}`}
            >
              {getQuoteStatusLabel(quote.status)}
            </span>
          </div>

          <div className="quote-premium-page__hero-actions">
            <Button
              variant="primary"
              type="button"
              onClick={handleCreateInvoiceFromQuote}
              disabled={creatingInvoice}
              aria-label="Transformer en facture"
              title="Transformer en facture"
            >
              <AttachmentIcon />
            </Button>

            <Button
              variant="secondary"
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              aria-label="Télécharger le PDF"
              title="Télécharger le PDF"
            >
              <DownloadIcon />
            </Button>
          </div>
        </div>
      </header>

      <div className="quote-premium-page__page-content">
        {activePage === "builder" ? (
          <div className="quote-premium-page__page-stack">
            <div className="quote-premium-page__builder-columns">
              <section className="quote-premium-page__section-panel quote-premium-page__section-panel--rooms">
                <QuoteRoomsSection
                  rooms={rooms}
                  items={items}
                  showForm={showRoomForm}
                  form={roomForm}
                  saving={savingRoom}
                  error={error}
                  deletingRoomId={deletingRoomId}
                  onOpenForm={openRoomForm}
                  onCloseForm={closeRoomForm}
                  onSubmit={handleAddRoom}
                  onChange={updateRoomField}
                  onDelete={handleDeleteRoom}
                />
              </section>

              <section className="quote-premium-page__section-panel quote-premium-page__section-panel--items">
                <QuoteItemsSection
                  services={services}
                  showCatalogPicker={showCatalogPicker}
                  catalogSearch={catalogSearch}
                  catalogCategory={catalogCategory}
                  catalogRoomId={catalogRoomId}
                  addingCatalogServiceId={addingCatalogServiceId}
                  items={items}
                  rooms={rooms}
                  roomMap={roomMap}
                  showForm={showItemForm}
                  form={itemForm}
                  saving={savingItem}
                  editingItemId={editingItemId}
                  deletingItemId={deletingItemId}
                  error={error}
                  movingItem={movingItem}
                  moveRoomId={moveRoomId}
                  movingItemLoading={movingItemLoading}
                  onOpenCreateForm={openCreateItemForm}
                  onCloseForm={closeItemForm}
                  onOpenCatalogPicker={openCatalogPicker}
                  onCloseCatalogPicker={closeCatalogPicker}
                  onCatalogSearchChange={setCatalogSearch}
                  onCatalogCategoryChange={setCatalogCategory}
                  onCatalogRoomChange={setCatalogRoomId}
                  onAddFromCatalog={handleAddFromCatalog}
                  onSubmit={handleSaveItem}
                  onChange={updateItemField}
                  onEdit={openEditItemForm}
                  onDuplicate={handleDuplicateItem}
                  onOpenMove={openMoveItem}
                  onCloseMove={closeMoveItem}
                  onMoveRoomChange={setMoveRoomId}
                  onConfirmMove={handleMoveItem}
                  onDelete={handleDeleteItem}
                />
              </section>
            </div>

            <section className="quote-premium-page__section-panel quote-premium-page__section-panel--summary">
              <QuoteSummarySection quote={quote} />
            </section>
          </div>
        ) : (
          <div className="quote-premium-page__page-stack">
            <form className="quote-premium-page__general-form" onSubmit={handleSaveQuoteGeneral}>
              <Card className="quote-premium-page__edit-card">
                <div className="quote-premium-page__section-header">
                  <div>
                    <h2 className="quote-premium-page__section-title">Identité du devis</h2>
                  </div>

                  <div className="quote-premium-page__section-actions" ref={generalMenuRef}>
                    <button
                      type="button"
                      className="quote-premium-page__more-btn"
                      aria-haspopup="menu"
                      aria-expanded={showGeneralMenu}
                      aria-label="Plus d'actions"
                      onClick={() => setShowGeneralMenu((current) => !current)}
                    >
                      ⋯
                    </button>

                    {showGeneralMenu ? (
                      <div className="quote-premium-page__dropdown-menu" role="menu">
                        <button
                          type="button"
                          className="quote-premium-page__dropdown-item"
                          role="menuitem"
                          onClick={() => {
                            applyCompanyDefaultsToQuote();
                            setShowGeneralMenu(false);
                          }}
                        >
                          Réappliquer les paramètres
                        </button>

                        <button
                          type="button"
                          className="quote-premium-page__dropdown-item"
                          role="menuitem"
                          onClick={() => {
                            resetQuoteGeneralForm();
                            setShowGeneralMenu(false);
                          }}
                        >
                          Réinitialiser le formulaire
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="quote-premium-page__compact-grid quote-premium-page__compact-grid--hero">
                  <FormField label="Numéro de devis">
                    <TextInput
                      className="quote-premium-page__field-control"
                      value={quote.quote_number}
                      readOnly
                    />
                  </FormField>

                  <FormField label="Titre">
                    <TextInput
                      className="quote-premium-page__field-control"
                      value={quoteGeneralForm.title}
                      onChange={(e) => updateQuoteGeneralField("title", e.target.value)}
                      placeholder="Peinture intérieure maison"
                    />
                  </FormField>
                </div>

                <FormField label="Description">
                  <TextArea
                    className="quote-premium-page__field-control quote-premium-page__field-control--textarea"
                    rows={3}
                    value={quoteGeneralForm.description}
                    onChange={(e) => updateQuoteGeneralField("description", e.target.value)}
                    placeholder="Travaux de peinture intérieure, préparation, finitions..."
                  />
                </FormField>
              </Card>

              <Card className="quote-premium-page__edit-card">
                <div className="quote-premium-page__section-header">
                  <div>
                    <h2 className="quote-premium-page__section-title">Dates et tarification</h2>
                  </div>
                </div>

                <div className="quote-premium-page__compact-grid quote-premium-page__compact-grid--triple">
                  <FormField label="Statut">
                    <Select
                      className="quote-premium-page__field-control"
                      value={quoteGeneralForm.status}
                      onChange={(e) =>
                        updateQuoteGeneralField("status", e.target.value as QuoteStatus)
                      }
                    >
                      <option value="draft">{getQuoteStatusLabel("draft")}</option>
                      <option value="sent">{getQuoteStatusLabel("sent")}</option>
                      <option value="accepted">{getQuoteStatusLabel("accepted")}</option>
                      <option value="rejected">{getQuoteStatusLabel("rejected")}</option>
                      <option value="expired">{getQuoteStatusLabel("expired")}</option>
                      <option value="invoiced">{getQuoteStatusLabel("invoiced")}</option>
                    </Select>
                  </FormField>

                  <FormField label="Date du devis">
                    <TextInput
                      className="quote-premium-page__field-control"
                      type="date"
                      value={quoteGeneralForm.issue_date}
                      onChange={(e) => updateQuoteGeneralField("issue_date", e.target.value)}
                    />
                  </FormField>

                  <FormField label="Valable jusqu'au">
                    <TextInput
                      className="quote-premium-page__field-control"
                      type="date"
                      value={quoteGeneralForm.valid_until}
                      onChange={(e) => updateQuoteGeneralField("valid_until", e.target.value)}
                    />
                  </FormField>
                </div>

                <div className="quote-premium-page__compact-grid quote-premium-page__compact-grid--single-compact">
                  <FormField label="TVA (%)">
                    <TextInput
                      className="quote-premium-page__field-control"
                      type="number"
                      step="0.01"
                      value={quoteGeneralForm.tva_rate}
                      onChange={(e) => updateQuoteGeneralField("tva_rate", e.target.value)}
                    />
                  </FormField>
                </div>
              </Card>

              <Card className="quote-premium-page__edit-card">
                <div className="quote-premium-page__section-header">
                  <div>
                    <h2 className="quote-premium-page__section-title">Texte commercial</h2>
                  </div>
                </div>

                <div className="quote-premium-page__compact-grid quote-premium-page__compact-grid--double-textarea">
                  <FormField label="Notes">
                    <TextArea
                      className="quote-premium-page__field-control quote-premium-page__field-control--textarea"
                      rows={5}
                      value={quoteGeneralForm.notes}
                      onChange={(e) => updateQuoteGeneralField("notes", e.target.value)}
                      placeholder="Merci pour votre confiance. Voici notre proposition pour les travaux demandés."
                    />
                  </FormField>

                  <FormField label="Conditions">
                    <TextArea
                      className="quote-premium-page__field-control quote-premium-page__field-control--textarea"
                      rows={5}
                      value={quoteGeneralForm.terms}
                      onChange={(e) => updateQuoteGeneralField("terms", e.target.value)}
                      placeholder="Délais, validité, modalités de règlement, préparation du chantier..."
                    />
                  </FormField>
                </div>
              </Card>

              <div className="quote-premium-page__form-footer">
                <Button type="submit" disabled={savingGeneral}>
                  {savingGeneral ? "Enregistrement..." : "Enregistrer les modifications"}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
