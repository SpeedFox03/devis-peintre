import type { QuotePdfData, PdfTheme } from "./quotePdfTypes";
import { resolvePdfTheme } from "./quotePdfTypes";
import { buildQuotePdfDefinition } from "./buildQuotePdfDefinition";
import { buildCompactQuotePdfDefinition } from "./buildCompactQuotePdfDefinition";
import { buildElegantQuotePdfDefinition } from "./buildElegantQuotePdfDefinition";
import { registerElegantFonts } from "./elegantFontAssets";
import { fetchImageAsBase64 } from "./fetchImageAsBase64";
import { applyPdfFontSizeAdjustment } from "./applyPdfFontSizeAdjustment";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

type PdfMakeWithVfs = typeof pdfMake & {
  vfs?: Record<string, string>;
  addVirtualFileSystem?: (vfs: Record<string, string>) => void;
  addFonts?: (fonts: Record<string, Record<string, string>>) => void;
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
  colorMode?: boolean | null,
  accentColor?: string | null
) {
  const resolvedTheme = resolvePdfTheme(theme);

  const logoBase64 = await fetchImageAsBase64(data.company?.logo_url);

  const fullData: QuotePdfData = {
    ...data,
    logoBase64,
    colorMode: colorMode ?? data.colorMode ?? true,
    accentColor: accentColor ?? data.accentColor ?? null,
  };

  let definition;

  if (resolvedTheme === "compact") {
    definition = buildCompactQuotePdfDefinition(fullData);
  } else if (resolvedTheme === "elegant") {
    // Le thème Élégant s'appuie sur des polices embarquées (Playfair Display + Great
    // Vibes). Elles doivent être déclarées dans pdfmake avant createPdf.
    if (pdfMakeWithVfs.addVirtualFileSystem && pdfMakeWithVfs.addFonts) {
      registerElegantFonts({
        addVirtualFileSystem: pdfMakeWithVfs.addVirtualFileSystem.bind(pdfMake),
        addFonts: pdfMakeWithVfs.addFonts.bind(pdfMake),
      });
    }
    definition = buildElegantQuotePdfDefinition(fullData);
  } else {
    // "normal" (aere=false) ou "aere" (aere=true)
    definition = buildQuotePdfDefinition(fullData, resolvedTheme === "aere");
  }

  return pdfMake.createPdf(
    applyPdfFontSizeAdjustment(
      definition,
      fullData.quote.pdf_font_size_adjustment,
    ),
  );
}
