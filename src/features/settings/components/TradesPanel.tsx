import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { supabase } from "../../../lib/supabase";
import { useCatalogTaxonomy } from "../../catalog/catalogTaxonomy";
import "./TradesPanel.css";

type DeactivationPreview = {
  services_to_hide: number;
  services_kept: number;
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

export function TradesPanel() {
  const { trades, activeTrades, loading, error, refresh } =
    useCatalogTaxonomy();

  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null);
  const [preview, setPreview] = useState<DeactivationPreview | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missingCount, setMissingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [missingToken, setMissingToken] = useState(0);

  const activeSlugs = new Set(activeTrades.map((trade) => trade.slug));

  // Le catalogue type évolue après l'activation. On propose la mise à niveau
  // plutôt que de l'appliquer en silence.
  useEffect(() => {
    let cancelled = false;

    async function countMissing() {
      const { data, error: rpcError } = await supabase.rpc(
        "count_missing_trade_services",
      );
      if (cancelled || rpcError) return;
      setMissingCount(Number(data ?? 0));
    }

    void countMissing();
    return () => {
      cancelled = true;
    };
  }, [missingToken]);

  async function syncCatalogs() {
    setSyncing(true);
    setActionError(null);
    setNotice(null);

    const { data, error: rpcError } = await supabase.rpc(
      "sync_company_trade_catalogs",
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setSyncing(false);
      return;
    }

    const added = Number(
      (data as { services_added?: number } | null)?.services_added ?? 0,
    );
    setNotice(`${pluralize(added, "prestation")} ajoutée à votre catalogue.`);
    setSyncing(false);
    setMissingToken((token) => token + 1);
    refresh();
  }

  async function activate(slug: string, name: string) {
    setPendingSlug(slug);
    setActionError(null);
    setNotice(null);

    const { data, error: rpcError } = await supabase.rpc(
      "activate_company_trade",
      { p_trade_slug: slug },
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setPendingSlug(null);
      return;
    }

    const added = Number(
      (data as { services_added?: number } | null)?.services_added ?? 0,
    );
    const restored = Number(
      (data as { services_restored?: number } | null)?.services_restored ?? 0,
    );

    const parts = [];
    if (added > 0) parts.push(`${pluralize(added, "prestation")} ajoutée`);
    if (restored > 0) {
      parts.push(`${pluralize(restored, "prestation")} réaffichée`);
    }

    setNotice(
      parts.length > 0
        ? `${name} activé : ${parts.join(", ")}.`
        : `${name} activé. Votre catalogue contenait déjà ces prestations.`,
    );
    setPendingSlug(null);
    refresh();
  }

  /** Charge le décompte avant de masquer quoi que ce soit. */
  async function askConfirmation(slug: string) {
    setPendingSlug(slug);
    setActionError(null);
    setNotice(null);

    const { data, error: rpcError } = await supabase.rpc(
      "preview_company_trade_deactivation",
      { p_trade_slug: slug },
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setPendingSlug(null);
      return;
    }

    setPreview(data as DeactivationPreview);
    setConfirmingSlug(slug);
    setPendingSlug(null);
  }

  async function deactivate(slug: string, name: string) {
    setPendingSlug(slug);
    setActionError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "deactivate_company_trade",
      { p_trade_slug: slug },
    );

    if (rpcError) {
      setActionError(rpcError.message);
      setPendingSlug(null);
      return;
    }

    const hidden = Number(
      (data as { services_hidden?: number } | null)?.services_hidden ?? 0,
    );

    setNotice(`${name} retiré : ${pluralize(hidden, "prestation")} masquée.`);
    setConfirmingSlug(null);
    setPreview(null);
    setPendingSlug(null);
    refresh();
  }

  if (loading) return <LoadingBlock message="Chargement des métiers..." />;

  return (
    <div className="trades-panel">
      <header className="trades-panel__header">
        <p className="trades-panel__eyebrow">Catalogue</p>
        <h2 className="trades-panel__title">Vos métiers</h2>
        <p className="trades-panel__intro">
          Activer un métier ajoute ses prestations types à votre catalogue, avec
          des prix indicatifs que vous ajustez ensuite. Vous en possédez alors
          la totalité : nous ne les modifions plus jamais.
        </p>
      </header>

      {missingCount > 0 ? (
        <div className="trades-panel__update" role="status">
          <div>
            <p className="trades-panel__update-title">
              {pluralize(missingCount, "nouvelle prestation type", "nouvelles prestations types")}{" "}
              {missingCount > 1 ? "sont disponibles" : "est disponible"}
            </p>
            <p className="trades-panel__update-text">
              Ajout uniquement : vos prix et vos libellés ne sont pas touchés.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={syncing}
            onClick={() => void syncCatalogs()}
          >
            {syncing ? "Ajout..." : "Compléter mon catalogue"}
          </Button>
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}
      {actionError ? <ErrorMessage message={actionError} /> : null}
      {notice ? (
        <p className="trades-panel__notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="trades-panel__grid">
        {trades.map((trade) => {
          const isActive = activeSlugs.has(trade.slug);
          const isBusy = pendingSlug === trade.slug;
          const isConfirming = confirmingSlug === trade.slug;
          const isLastActive = isActive && activeTrades.length <= 1;

          return (
            <Card key={trade.id} className="trades-panel__card">
              <div className="trades-panel__card-head">
                <h3>{trade.name}</h3>
                <span
                  className={`trades-panel__badge trades-panel__badge--${
                    isActive ? "on" : "off"
                  }`}
                >
                  {isActive ? "Activé" : "Disponible"}
                </span>
              </div>

              {trade.description ? (
                <p className="trades-panel__card-text">{trade.description}</p>
              ) : null}

              {isConfirming && preview ? (
                <div className="trades-panel__confirm" role="alert">
                  <p className="trades-panel__confirm-title">
                    Retirer {trade.name} ?
                  </p>
                  <p className="trades-panel__confirm-text">
                    {pluralize(preview.services_to_hide, "prestation")} sera
                    masquée
                    {preview.services_kept > 0
                      ? `, ${
                        pluralize(preview.services_kept, "prestation")
                      } conservée car vous l'avez modifiée ou déjà utilisée dans un devis`
                      : ""}
                    . Rien n'est supprimé : réactiver le métier les fait revenir.
                  </p>
                  <div className="trades-panel__card-actions">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void deactivate(trade.slug, trade.name)}
                    >
                      {isBusy ? "Retrait..." : "Confirmer le retrait"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConfirmingSlug(null);
                        setPreview(null);
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="trades-panel__card-actions">
                  {isActive ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isBusy || isLastActive}
                      title={isLastActive
                        ? "Au moins un métier doit rester actif."
                        : undefined}
                      onClick={() => void askConfirmation(trade.slug)}
                    >
                      {isBusy ? "Vérification..." : "Retirer"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void activate(trade.slug, trade.name)}
                    >
                      {isBusy ? "Activation..." : "Activer"}
                    </Button>
                  )}
                </div>
              )}

              {isLastActive && !isConfirming ? (
                <p className="trades-panel__card-hint">
                  Dernier métier actif : il ne peut pas être retiré.
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
