import type { QuotePdfData, PdfTheme } from "./quotePdfTypes";
import { resolvePdfTheme } from "./quotePdfTypes";
import { buildQuotePdfDefinition } from "./buildQuotePdfDefinition";
import { buildCompactQuotePdfDefinition } from "./buildCompactQuotePdfDefinition";
import { fetchImageAsBase64 } from "./fetchImageAsBase64";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

type PdfMakeWithVfs = typeof pdfMake & {
  vfs?: Record<string, string>;
};

const pdfMakeWithVfs = pdfMake as PdfMakeWithVfs;

if (!pdfMakeWithVfs.vfs) {
  const fontsSource = pdfFonts as unknown as {
    pdfMake?: { vfs?: Record<string, string> };
    vfs?: Record<string, string>;
  };
  pdfMakeWithVfs.vfs = fontsSource?.pdfMake?.vfs || fontsSource?.vfs || {};
}

export async function generateQuotePdf(
  data: Omit<QuotePdfData, "logoBase64">,
  theme?: PdfTheme | string | null,
  colorMode?: boolean | null
) {
  const resolvedTheme = resolvePdfTheme(theme);

  const logoBase64 = await fetchImageAsBase64(data.company?.logo_url);

  const fullData: QuotePdfData = {
    ...data,
    logoBase64,
    colorMode: colorMode ?? data.colorMode ?? true, // couleur par défaut
  };

  if (resolvedTheme === "compact") {
    return pdfMake.createPdf(buildCompactQuotePdfDefinition(fullData));
  }

  // "normal" (aere=false) ou "aere" (aere=true)
  return pdfMake.createPdf(buildQuotePdfDefinition(fullData, resolvedTheme === "aere"));
}