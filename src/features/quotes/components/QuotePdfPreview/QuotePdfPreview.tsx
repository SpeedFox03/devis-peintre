import { useEffect, useState } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { generateQuotePdf } from "../../pdf/generateQuotePdf";
import { loadQuotePdfData } from "../../pdf/loadQuotePdfData";
import "./QuotePdfPreview.css";

type QuotePdfPreviewProps = {
  quoteId: string;
  quoteNumber: string;
};

export function QuotePdfPreview({ quoteId, quoteNumber }: QuotePdfPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    async function createPreview() {
      setLoading(true);
      setError(null);
      setPdfUrl(null);

      try {
        const { data, theme, colorMode, accentColor } = await loadQuotePdfData(quoteId);
        const pdf = await generateQuotePdf(data, theme, colorMode, accentColor);
        const blob = await pdf.getBlob();
        createdUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          createdUrl = null;
          return;
        }

        setPdfUrl(createdUrl);
      } catch (previewError) {
        if (!cancelled) {
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Impossible de générer la prévisualisation du devis.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void createPreview();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [quoteId, refreshKey]);

  return (
    <section className="quote-pdf-preview" aria-labelledby="quote-pdf-preview-title">
      <div className="quote-pdf-preview__header">
        <div>
          <p className="quote-pdf-preview__eyebrow">Devis {quoteNumber}</p>
          <h2 id="quote-pdf-preview-title">Prévisualisation du PDF</h2>
          <p>Le document utilise le modèle, les couleurs et les informations actuellement enregistrés.</p>
        </div>

        <div className="quote-pdf-preview__actions">
          {pdfUrl ? (
            <a
              className="ui-button ui-button--secondary ui-button--md"
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
            >
              Ouvrir en grand
            </a>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
          >
            {loading ? "Génération..." : "Actualiser"}
          </Button>
        </div>
      </div>

      <div className="quote-pdf-preview__viewport">
        {loading ? (
          <div className="quote-pdf-preview__state" role="status">
            <span className="quote-pdf-preview__spinner" aria-hidden="true" />
            <strong>Génération du devis...</strong>
            <p>Le PDF va s'afficher directement dans cette page.</p>
          </div>
        ) : error ? (
          <div className="quote-pdf-preview__state quote-pdf-preview__state--error" role="alert">
            <strong>Prévisualisation indisponible</strong>
            <p>{error}</p>
            <Button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
              Réessayer
            </Button>
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} title={"Prévisualisation du devis " + quoteNumber} />
        ) : null}
      </div>
    </section>
  );
}
