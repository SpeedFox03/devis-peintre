import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/ui/PageHeader/PageHeader";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { EmptyState } from "../../../components/ui/EmptyState/EmptyState";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { Select } from "../../../components/ui/Select/Select";
import { QuoteSummarySection } from "../components/QuoteSummarySection/QuoteSummarySection";
import { QuoteRoomsSection } from "../components/QuoteRoomsSection/QuoteRoomsSection";
import { QuoteItemsSection } from "../components/QuoteItemsSection/QuoteItemsSection";
import { useQuoteDetailsPage } from "../hooks/useQuoteDetailsPage";
import { getQuoteStatusLabel, type QuoteStatus } from "../types";
import "./QuoteDetailsPage.css";

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
    <section className="quote-details-page">
      <PageHeader
        title={`${quote.quote_number} — ${quote.title}`}
        description={`Statut : ${getQuoteStatusLabel(quote.status)}`}
        actions={
          <div className="quote-details-page__header-actions">
            <Button
              variant="primary"
              type="button"
              onClick={handleCreateInvoiceFromQuote}
              disabled={creatingInvoice}
            >
              {creatingInvoice ? "Transformation..." : "Transformer en facture"}
            </Button>

            <Button
              variant="primary"
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? "Génération..." : "Télécharger le PDF"}
            </Button>

            <Link to="/">
              <Button variant="secondary" type="button">
                Retour aux devis
              </Button>
            </Link>
          </div>
        }
      />

      <Card>
        <form className="quotes-page__form" onSubmit={handleSaveQuoteGeneral}>
          <h2 className="quotes-page__form-title">Informations générales du devis</h2>

          <FormGrid columns="2">
            <FormField label="Numéro de devis">
              <TextInput value={quote.quote_number} readOnly />
            </FormField>

            <FormField label="Titre">
              <TextInput
                value={quoteGeneralForm.title}
                onChange={(e) => updateQuoteGeneralField("title", e.target.value)}
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

          <FormGrid columns="2">
            <FormField label="Statut">
              <Select
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

            <div />
          </FormGrid>

          <FormGrid columns="2">
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
              onChange={(e) => updateQuoteGeneralField("notes", e.target.value)}
            />
          </FormField>

          <FormField label="Conditions">
            <TextArea
              rows={4}
              value={quoteGeneralForm.terms}
              onChange={(e) => updateQuoteGeneralField("terms", e.target.value)}
            />
          </FormField>

          <div className="quote-details-page__header-actions">
            <Button type="submit" disabled={savingGeneral}>
              {savingGeneral ? "Enregistrement..." : "Enregistrer"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={applyCompanyDefaultsToQuote}
            >
              Réappliquer les paramètres entreprise
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={resetQuoteGeneralForm}
            >
              Réinitialiser
            </Button>
          </div>
        </form>
      </Card>

      <QuoteSummarySection quote={quote} />

      <div className="quote-details-page__layout">
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

      {error && <ErrorMessage message={error} />}
    </section>
  );
}