import { Card } from "../../../../components/ui/Card/Card";
import "./QuoteSummarySection.css";

type QuoteSummary = {
  subtotal_ht: number;
  total_tva: number;
  total_ttc: number;
  tva_rate: number;
};

type QuoteSummarySectionProps = {
  quote: QuoteSummary;
};

function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export function QuoteSummarySection({ quote }: QuoteSummarySectionProps) {
  const totalHt = Number(quote.subtotal_ht || 0);
  const totalTva = Number(quote.total_tva || 0);
  const totalTtc = Number(quote.total_ttc || 0);
  const tvaRate = Number(quote.tva_rate || 0);

  return (
    <section className="quote-summary-premium">
      <div className="quote-summary-premium__header">
        <div>
          <p className="quote-summary-premium__eyebrow">Synthèse financière</p>
          <h2 className="quote-summary-premium__title">Résumé du devis</h2>
        </div>

        <div className="quote-summary-premium__tax-chip">
          TVA par défaut : {tvaRate.toFixed(2)} %
        </div>
      </div>

      <div className="quote-summary-premium__grid">
        <Card>
          <div className="quote-summary-premium__stat">
            <p className="quote-summary-premium__label">Sous-total HT</p>
            <p className="quote-summary-premium__value">
              {formatCurrency(totalHt)}
            </p>
            <p className="quote-summary-premium__hint">
              Montant hors taxes du devis avant totalisation finale.
            </p>
          </div>
        </Card>

        <Card>
          <div className="quote-summary-premium__stat">
            <p className="quote-summary-premium__label">Montant TVA</p>
            <p className="quote-summary-premium__value">
              {formatCurrency(totalTva)}
            </p>
            <p className="quote-summary-premium__hint">
              Total de taxe calculé sur l’ensemble des lignes du devis.
            </p>
          </div>
        </Card>

        <Card>
          <div className="quote-summary-premium__stat quote-summary-premium__stat--highlight">
            <p className="quote-summary-premium__label">Total TTC</p>
            <p className="quote-summary-premium__value quote-summary-premium__value--strong">
              {formatCurrency(totalTtc)}
            </p>
            <p className="quote-summary-premium__hint">
              Montant final communiqué au client.
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}