import type { QuotePdfData } from "./quotePdfTypes";
import { buildQuotePdfDefinition } from "./buildQuotePdfDefinition";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

type PdfMakeWithVfs = typeof pdfMake & {
  vfs?: Record<string, string>;
};

const pdfMakeWithVfs = pdfMake as PdfMakeWithVfs;

if (!pdfMakeWithVfs.vfs) {
  const fontsSource = pdfFonts as unknown as { pdfMake?: { vfs?: Record<string, string> }; vfs?: Record<string, string> };
  pdfMakeWithVfs.vfs = fontsSource?.pdfMake?.vfs || fontsSource?.vfs || {};
}

export function generateQuotePdf(data: QuotePdfData) {
  const definition = buildQuotePdfDefinition(data);
  return pdfMake.createPdf(definition);
}