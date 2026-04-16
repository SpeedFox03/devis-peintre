import { SectionCard } from "../../../../components/ui/SectionCard/SectionCard";
import { StatCard } from "../../../../components/ui/StatCard/StatCard";
import { InfoList } from "../../../../components/ui/InfoList/InfoList";
import "./QuoteSummarySection.css";

type QuoteSummarySectionProps = {
  quote: {
    quote_number: string;
    issue_date: string;
    valid_until: string | null;
    tva_rate: number;
    description: string | null;
    notes: string | null;
    terms: string | null;
    subtotal_ht: number;
    total_tva: number;
    total_ttc: number;
  };
};

export function QuoteSummarySection({ quote }: QuoteSummarySectionProps) {
  return (
    <div className="quote-summary-section">
      <div className="quote-summary-section__stats">
        <StatCard
          label="Sous-total HT"
          value={`${Number(quote.subtotal_ht).toFixed(2)} €`}
        />
        <StatCard
          label="TVA"
          value={`${Number(quote.total_tva).toFixed(2)} €`}
        />
        <StatCard
          label="Total TTC"
          value={`${Number(quote.total_ttc).toFixed(2)} €`}
        />
      </div>

      <SectionCard title="Informations du devis">
        <InfoList
          items={[
            { label: "Numéro", value: quote.quote_number },
            { label: "Date", value: quote.issue_date },
            { label: "Valable jusqu'au", value: quote.valid_until || "-" },
            { label: "TVA", value: `${quote.tva_rate}%` },
            { label: "Description", value: quote.description || "-" },
            { label: "Notes", value: quote.notes || "-" },
            { label: "Conditions", value: quote.terms || "-" },
          ]}
        />
      </SectionCard>
    </div>
  );
}