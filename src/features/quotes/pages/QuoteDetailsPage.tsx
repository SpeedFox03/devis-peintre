import { Link } from "react-router-dom";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
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

export function QuoteDetailsPage() {
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

  return (
    <section className="quote-premium-page">
      <header className="quote-premium-page__hero">
        <div className="quote-premium-page__hero-main">
          <div className="quote-premium-page__hero-topline">
            <Link to="/" className="quote-premium-page__backlink">
              ← Retour aux devis
            </Link>

            <span className="quote-premium-page__separator">•</span>

            <span className="quote-premium-page__quote-number">
              {quote.quote_number}
            </span>
          </div>

          <div className="quote-premium-page__hero-title-row">
            <div>
              <p className="quote-premium-page__eyebrow">Document commercial</p>
              <h1 className="quote-premium-page__hero-title">{quote.title}</h1>
              <p className="quote-premium-page__hero-description">
                Modifie les informations générales, structure les pièces et compose
                les lignes du devis dans une interface plus claire et plus fluide.
              </p>
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
        <Card>
          <p className="quote-premium-page__stat-label">Total HT</p>
          <p className="quote-premium-page__stat-value">
            {formatCurrency(quote.subtotal_ht)}
          </p>
        </Card>

        <Card>
          <p className="quote-premium-page__stat-label">TVA</p>
          <p className="quote-premium-page__stat-value">
            {formatCurrency(quote.total_tva)}
          </p>
        </Card>

        <Card>
          <p className="quote-premium-page__stat-label">Total TTC</p>
          <p className="quote-premium-page__stat-value">
            {formatCurrency(quote.total_ttc)}
          </p>
        </Card>

        <Card>
          <p className="quote-premium-page__stat-label">Lignes</p>
          <p className="quote-premium-page__stat-value">{items.length}</p>
        </Card>
      </div>

      <div className="quote-premium-page__layout">
        <aside className="quote-premium-page__left">
          <Card>
            <nav className="quote-premium-page__nav" aria-label="Navigation devis">
              <p className="quote-premium-page__nav-title">Navigation rapide</p>

              <a href="#quote-general" className="quote-premium-page__nav-link">
                Informations générales
              </a>
              <a href="#quote-summary" className="quote-premium-page__nav-link">
                Résumé
              </a>
              <a href="#quote-rooms" className="quote-premium-page__nav-link">
                Pièces
              </a>
              <a href="#quote-items" className="quote-premium-page__nav-link">
                Lignes
              </a>
            </nav>
          </Card>

          <Card>
            <div className="quote-premium-page__side-card">
              <p className="quote-premium-page__side-label">Vue d’ensemble</p>
              <ul className="quote-premium-page__meta-list">
                <li>
                  <span>Date du devis</span>
                  <strong>{quote.issue_date}</strong>
                </li>
                <li>
                  <span>Valable jusqu’au</span>
                  <strong>{quote.valid_until || "-"}</strong>
                </li>
                <li>
                  <span>TVA</span>
                  <strong>{quote.tva_rate.toFixed(2)} %</strong>
                </li>
                <li>
                  <span>Pièces</span>
                  <strong>{rooms.length}</strong>
                </li>
              </ul>
            </div>
          </Card>
        </aside>

        <div className="quote-premium-page__center">
          <section id="quote-general" className="quote-premium-page__section">
            <Card>
              <div className="quote-premium-page__section-header">
                <div>
                  <p className="quote-premium-page__section-eyebrow">Bloc 01</p>
                  <h2 className="quote-premium-page__section-title">
                    Informations générales
                  </h2>
                </div>

                <div className="quote-premium-page__section-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={applyCompanyDefaultsToQuote}
                  >
                    Réappliquer paramètres entreprise
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetQuoteGeneralForm}
                  >
                    Réinitialiser
                  </Button>
                </div>
              </div>

              <form
                className="quote-premium-page__general-form"
                onSubmit={handleSaveQuoteGeneral}
              >
                <FormGrid columns="2">
                  <FormField label="Numéro de devis">
                    <TextInput value={quote.quote_number} readOnly />
                  </FormField>

                  <FormField label="Titre">
                    <TextInput
                      value={quoteGeneralForm.title}
                      onChange={(e) =>
                        updateQuoteGeneralField("title", e.target.value)
                      }
                      placeholder="Peinture intérieure maison"
                    />
                  </FormField>
                </FormGrid>

                <FormField label="Description">
                  <TextArea
                    rows={3}
                    value={quoteGeneralForm.description}
                    onChange={(e) =>
                      updateQuoteGeneralField("description", e.target.value)
                    }
                  />
                </FormField>

                <FormGrid columns="3">
                  <FormField label="Statut">
                    <Select
                      value={quoteGeneralForm.status}
                      onChange={(e) =>
                        updateQuoteGeneralField(
                          "status",
                          e.target.value as QuoteStatus
                        )
                      }
                    >
                      <option value="draft">{getQuoteStatusLabel("draft")}</option>
                      <option value="sent">{getQuoteStatusLabel("sent")}</option>
                      <option value="accepted">
                        {getQuoteStatusLabel("accepted")}
                      </option>
                      <option value="rejected">
                        {getQuoteStatusLabel("rejected")}
                      </option>
                      <option value="expired">
                        {getQuoteStatusLabel("expired")}
                      </option>
                      <option value="invoiced">
                        {getQuoteStatusLabel("invoiced")}
                      </option>
                    </Select>
                  </FormField>

                  <FormField label="Date du devis">
                    <TextInput
                      type="date"
                      value={quoteGeneralForm.issue_date}
                      onChange={(e) =>
                        updateQuoteGeneralField("issue_date", e.target.value)
                      }
                    />
                  </FormField>

                  <FormField label="Valable jusqu'au">
                    <TextInput
                      type="date"
                      value={quoteGeneralForm.valid_until}
                      onChange={(e) =>
                        updateQuoteGeneralField("valid_until", e.target.value)
                      }
                    />
                  </FormField>
                </FormGrid>

                <FormGrid columns="2">
                  <FormField label="TVA (%)">
                    <TextInput
                      type="number"
                      step="0.01"
                      value={quoteGeneralForm.tva_rate}
                      onChange={(e) =>
                        updateQuoteGeneralField("tva_rate", e.target.value)
                      }
                    />
                  </FormField>

                  <div />
                </FormGrid>

                <FormField label="Notes">
                  <TextArea
                    rows={3}
                    value={quoteGeneralForm.notes}
                    onChange={(e) =>
                      updateQuoteGeneralField("notes", e.target.value)
                    }
                  />
                </FormField>

                <FormField label="Conditions">
                  <TextArea
                    rows={4}
                    value={quoteGeneralForm.terms}
                    onChange={(e) =>
                      updateQuoteGeneralField("terms", e.target.value)
                    }
                  />
                </FormField>

                <div className="quote-premium-page__form-footer">
                  <Button type="submit" disabled={savingGeneral}>
                    {savingGeneral ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                </div>
              </form>
            </Card>
          </section>

          <section id="quote-summary" className="quote-premium-page__section">
            <div className="quote-premium-page__embedded-section">
              <div className="quote-premium-page__section-header quote-premium-page__section-header--tight">
                <div>
                  <p className="quote-premium-page__section-eyebrow">Bloc 02</p>
                  <h2 className="quote-premium-page__section-title">Résumé</h2>
                </div>
              </div>

              <QuoteSummarySection quote={quote} />
            </div>
          </section>

          <section id="quote-rooms" className="quote-premium-page__section">
            <div className="quote-premium-page__embedded-section">
              <div className="quote-premium-page__section-header quote-premium-page__section-header--tight">
                <div>
                  <p className="quote-premium-page__section-eyebrow">Bloc 03</p>
                  <h2 className="quote-premium-page__section-title">Pièces</h2>
                </div>
              </div>

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
            </div>
          </section>

          <section id="quote-items" className="quote-premium-page__section">
            <div className="quote-premium-page__embedded-section">
              <div className="quote-premium-page__section-header quote-premium-page__section-header--tight">
                <div>
                  <p className="quote-premium-page__section-eyebrow">Bloc 04</p>
                  <h2 className="quote-premium-page__section-title">Lignes</h2>
                </div>
              </div>

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
            </div>
          </section>
        </div>

        <aside className="quote-premium-page__right">
          <Card>
            <div className="quote-premium-page__side-card">
              <p className="quote-premium-page__side-label">Actions rapides</p>

              <div className="quote-premium-page__quick-actions">
                <Button
                  type="button"
                  variant="primary"
                  onClick={openCreateItemForm}
                >
                  Ajouter une ligne
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={openCatalogPicker}
                >
                  Ouvrir le catalogue
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={openRoomForm}
                >
                  Ajouter une pièce
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <div className="quote-premium-page__side-card">
              <p className="quote-premium-page__side-label">Repères</p>

              <ul className="quote-premium-page__meta-list">
                <li>
                  <span>Nombre de lignes</span>
                  <strong>{items.length}</strong>
                </li>
                <li>
                  <span>Nombre de pièces</span>
                  <strong>{rooms.length}</strong>
                </li>
                <li>
                  <span>Total TTC</span>
                  <strong>{formatCurrency(quote.total_ttc)}</strong>
                </li>
                <li>
                  <span>Catalogue ouvert</span>
                  <strong>{showCatalogPicker ? "Oui" : "Non"}</strong>
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="quote-premium-page__side-card">
              <p className="quote-premium-page__side-label">Conseil UX</p>
              <p className="quote-premium-page__hint-text">
                Utilise le catalogue pour partir d’une base métier standard, puis
                ajuste les lignes directement au niveau du devis.
              </p>
            </div>
          </Card>
        </aside>
      </div>

      {error && <ErrorMessage message={error} />}
    </section>
  );
}