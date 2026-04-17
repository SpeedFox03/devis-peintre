import { useEffect, useRef, useState } from "react";
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
import "./QuoteDetailsPage.css";

function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

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
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [activePage, setActivePage] = useState<QuotePageId>("builder");
  const generalMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (generalMenuRef.current && !generalMenuRef.current.contains(event.target as Node)) {
        setShowGeneralMenu(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowGeneralMenu(false);
        setShowMobileNav(false);
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

  const activePageData = quotePages.find((page) => page.id === activePage) ?? quotePages[0];

  return (
    <section className="quote-premium-page">
      <header className="quote-premium-page__hero">
        <div className="quote-premium-page__hero-main">
          <div className="quote-premium-page__hero-topline">
            <Link to="/" className="quote-premium-page__backlink">
              ← Retour aux devis
            </Link>
            <span className="quote-premium-page__separator">•</span>
            <span className="quote-premium-page__quote-number">{quote.quote_number}</span>
          </div>

          <div className="quote-premium-page__hero-title-row">
            <div className="quote-premium-page__hero-copy">
              <h1 className="quote-premium-page__hero-title">{quote.title}</h1>
            </div>

            <div
              className={`quote-premium-page__status-chip quote-premium-page__status-chip--${quote.status}`}
            >
              {getQuoteStatusLabel(quote.status)}
            </div>
          </div>
        </div>

        <div className="quote-premium-page__hero-actions">
          <Button
            variant="primary"
            type="button"
            onClick={handleCreateInvoiceFromQuote}
            disabled={creatingInvoice}
          >
            {creatingInvoice ? "Transformation..." : "Transformer en facture"}
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? "Génération..." : "Télécharger le PDF"}
          </Button>
        </div>
      </header>

      <div className="quote-premium-page__stats">
        <Card className="quote-premium-page__stat-card">
          <p className="quote-premium-page__stat-label">Total HT</p>
          <p className="quote-premium-page__stat-value">{formatCurrency(quote.subtotal_ht)}</p>
        </Card>

        <Card className="quote-premium-page__stat-card">
          <p className="quote-premium-page__stat-label">TVA</p>
          <p className="quote-premium-page__stat-value">{formatCurrency(quote.total_tva)}</p>
        </Card>

        <Card className="quote-premium-page__stat-card quote-premium-page__stat-card--strong">
          <p className="quote-premium-page__stat-label">Total TTC</p>
          <p className="quote-premium-page__stat-value">{formatCurrency(quote.total_ttc)}</p>
        </Card>

        <Card className="quote-premium-page__stat-card">
          <p className="quote-premium-page__stat-label">Validité</p>
          <p className="quote-premium-page__stat-value">{quote.valid_until || "-"}</p>
        </Card>
      </div>

      <div className="quote-premium-page__page-nav-shell">
        <div className="quote-premium-page__page-nav-mobile-bar">
          <div>
            <p className="quote-premium-page__nav-mobile-label">Page active</p>
            <strong className="quote-premium-page__nav-mobile-current">
              {activePageData.label}
            </strong>
          </div>

          <button
            type="button"
            className={`quote-premium-page__nav-toggle ${showMobileNav ? "is-open" : ""}`}
            aria-expanded={showMobileNav}
            aria-controls="quote-page-tabs"
            onClick={() => setShowMobileNav((current) => !current)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <nav
          id="quote-page-tabs"
          className={`quote-premium-page__page-nav ${
            showMobileNav ? "quote-premium-page__page-nav--open" : ""
          }`}
          aria-label="Pages du devis"
        >
          {quotePages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={`quote-premium-page__page-tab ${
                activePage === page.id ? "quote-premium-page__page-tab--active" : ""
              }`}
              onClick={() => {
                setActivePage(page.id);
                setShowMobileNav(false);
              }}
            >
              <span className="quote-premium-page__page-tab-label">{page.label}</span>
            </button>
          ))}
        </nav>
      </div>

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
                      aria-label="Plus d’actions"
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