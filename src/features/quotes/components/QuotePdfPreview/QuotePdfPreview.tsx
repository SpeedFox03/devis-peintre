import { useEffect, useRef, useState } from "react";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RenderTask,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { Button } from "../../../../components/ui/Button/Button";
import { generateQuotePdf } from "../../pdf/generateQuotePdf";
import { loadQuotePdfData } from "../../pdf/loadQuotePdfData";
import "./QuotePdfPreview.css";

type QuotePdfPreviewProps = {
  quoteId: string;
  quoteNumber: string;
};

type QuotePdfCanvasPageProps = {
  document: PDFDocumentProxy;
  pageNumber: number;
};

function QuotePdfCanvasPage({ document, pageNumber }: QuotePdfCanvasPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    let disposed = false;
    let page: PDFPageProxy | null = null;
    let renderTask: RenderTask | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;

    async function renderPage(width: number) {
      const canvas = canvasRef.current;
      if (!page || !canvas || width <= 0 || disposed) return;

      renderTask?.cancel();

      const baseViewport = page.getViewport({ scale: 1 });
      const cssScale = width / baseViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: cssScale * pixelRatio });

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(baseViewport.height * cssScale)}px`;

      const currentTask = page.render({ canvas, viewport });
      renderTask = currentTask;

      try {
        await currentTask.promise;
        if (!disposed && renderTask === currentTask) {
          setRendered(true);
          setRenderError(false);
        }
      } catch (error) {
        const renderWasCancelled = error instanceof Error && error.name === "RenderingCancelledException";
        if (!renderWasCancelled && !disposed) {
          setRenderError(true);
        }
      }
    }

    async function preparePage() {
      try {
        page = await document.getPage(pageNumber);
        if (disposed) return;

        const container = containerRef.current;
        if (!container) return;

        await renderPage(container.clientWidth);

        resizeObserver = new ResizeObserver(([entry]) => {
          if (!entry || disposed) return;
          if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);

          resizeFrame = window.requestAnimationFrame(() => {
            void renderPage(entry.contentRect.width);
          });
        });
        resizeObserver.observe(container);
      } catch {
        if (!disposed) setRenderError(true);
      }
    }

    void preparePage();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      renderTask?.cancel();
      page?.cleanup();
    };
  }, [document, pageNumber]);

  return (
    <div
      ref={containerRef}
      className={`quote-pdf-preview__page${rendered ? " quote-pdf-preview__page--rendered" : ""}`}
      aria-label={`Page ${pageNumber} du devis`}
    >
      {!rendered && !renderError ? (
        <div className="quote-pdf-preview__page-loading" role="status">
          Chargement de la page {pageNumber}…
        </div>
      ) : null}
      {renderError ? (
        <div className="quote-pdf-preview__page-error" role="alert">
          Impossible d’afficher la page {pageNumber}.
        </div>
      ) : null}
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}

export function QuotePdfPreview({ quoteId, quoteNumber }: QuotePdfPreviewProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    let loadingTask: PDFDocumentLoadingTask | null = null;

    async function createPreview() {
      setLoading(true);
      setError(null);
      setPdfUrl(null);
      setPdfDocument(null);

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

        const pdfBytes = new Uint8Array(await blob.arrayBuffer());
        const { GlobalWorkerOptions, getDocument } = await import(
          "pdfjs-dist/legacy/build/pdf.mjs"
        );
        GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        loadingTask = getDocument({ data: pdfBytes });
        const document = await loadingTask.promise;

        if (cancelled) {
          await loadingTask.destroy();
          return;
        }

        setPdfDocument(document);
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
      if (loadingTask) void loadingTask.destroy();
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
            <p>Les pages vont s’afficher directement dans cette page.</p>
          </div>
        ) : error ? (
          <div className="quote-pdf-preview__state quote-pdf-preview__state--error" role="alert">
            <strong>Prévisualisation indisponible</strong>
            <p>{error}</p>
            <Button type="button" onClick={() => setRefreshKey((current) => current + 1)}>
              Réessayer
            </Button>
          </div>
        ) : pdfDocument ? (
          <div className="quote-pdf-preview__pages">
            {Array.from({ length: pdfDocument.numPages }, (_, index) => (
              <QuotePdfCanvasPage
                key={index + 1}
                document={pdfDocument}
                pageNumber={index + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
