import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import type { QuotePdfData } from "./quotePdfTypes";

// ─── Palettes ─────────────────────────────────────────────────────────────────

type Palette = {
  ACCENT:       string;
  ACCENT_SOFT:  string;
  BORDER:       string;
  TEXT_DARK:    string;
  TEXT_MUTED:   string;
  BG_PAGE:      string;
  BG_CARD:      string;
  BG_SECTION:   string;
  BG_ROOM:      string;
  BG_ROW_ALT:   string;
};

/** Palette beige/taupe — thème "en couleur" */
const PALETTE_COLOR: Palette = {
  ACCENT:      "#8e7452",
  ACCENT_SOFT: "#a88f6c",
  BORDER:      "#d8cbb8",
  TEXT_DARK:   "#2f2a24",
  TEXT_MUTED:  "#6e6254",
  BG_PAGE:     "#f8f5ef",
  BG_CARD:     "#fffdf9",
  BG_SECTION:  "#efe7db",
  BG_ROOM:     "#f6efe4",
  BG_ROW_ALT:  "#f3ede3",
};

/** Palette noir & blanc */
const PALETTE_BW: Palette = {
  ACCENT:      "#111111",
  ACCENT_SOFT: "#555555",
  BORDER:      "#d0d0d0",
  TEXT_DARK:   "#111111",
  TEXT_MUTED:  "#666666",
  BG_PAGE:     "#ffffff",
  BG_CARD:     "#ffffff",
  BG_SECTION:  "#f0f0f0",
  BG_ROOM:     "#e8e8e8",
  BG_ROW_ALT:  "#f8f8f8",
};

function getPalette(colorMode?: boolean | null): Palette {
  return colorMode === true ? PALETTE_COLOR : PALETTE_BW;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function euro(value: number) {
  return `${Number(value).toFixed(2)} €`;
}

function displayCustomerName(customer: QuotePdfData["customer"]) {
  if (!customer) return "-";
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "-"
  );
}

function joinParts(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

// ─── Block builders ───────────────────────────────────────────────────────────

function makeCardCell(p: Palette, label: string, title: string, lines: string[]): TableCell {
  return {
    stack: [
      { text: label.toUpperCase(), color: p.ACCENT, fontSize: 9, characterSpacing: 1.2, margin: [0, 0, 0, 6] },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 38, y2: 0, lineWidth: 1.5, lineColor: p.ACCENT_SOFT }],
        margin: [0, 0, 0, 10],
      },
      { text: title, bold: true, fontSize: 14, color: p.TEXT_DARK, margin: [0, 0, 0, 8] },
      ...lines.filter(Boolean).map((line) => ({
        text: line, color: p.TEXT_DARK, fontSize: 10, margin: [0, 0, 0, 4],
      })),
    ],
    fillColor: p.BG_CARD,
    border: [true, true, true, true],
    borderColor: p.BORDER,
    margin: [10, 10, 10, 10],
    valign: "top",
  };
}

function makeSectionTitle(p: Palette, title: string, kicker?: string): Content {
  return {
    stack: [
      kicker ? { text: kicker.toUpperCase(), color: p.ACCENT, fontSize: 9, characterSpacing: 1.2, margin: [0, 0, 0, 4] } : undefined,
      { text: title, fontSize: 16, bold: true, color: p.TEXT_DARK },
    ].filter(Boolean) as Content[],
    margin: [0, 0, 0, 10],
  };
}

function makeInfoCardsRow(p: Palette, left: TableCell, right: TableCell): Content {
  return {
    table: {
      widths: ["*", 14, "*"],
      body: [[
        left,
        {
          border: [false, false, false, false],
          stack: [{
            canvas: [{ type: "line", x1: 7, y1: 0, x2: 7, y2: 84, lineWidth: 1, lineColor: p.ACCENT }],
            margin: [0, 14, 0, 14],
          }],
        },
        right,
      ]],
    },
    layout: { paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0, hLineWidth: () => 0, vLineWidth: () => 0 },
    margin: [0, 0, 0, 18],
    unbreakable: true,
  };
}

function makeTextCardCell(p: Palette, label: string, text: string): TableCell {
  return {
    stack: [
      { text: label.toUpperCase(), color: p.ACCENT, fontSize: 9, characterSpacing: 1.2, margin: [0, 0, 0, 6] },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 36, y2: 0, lineWidth: 1.5, lineColor: p.ACCENT_SOFT }],
        margin: [0, 0, 0, 10],
      },
      { text, color: p.TEXT_DARK, fontSize: 10, lineHeight: 1.35 },
    ],
    fillColor: p.BG_CARD,
    border: [true, true, true, true],
    borderColor: p.BORDER,
    margin: [12, 12, 12, 12],
    valign: "top",
  };
}

function makeCompanyIdentity(p: Palette, data: QuotePdfData): Content {
  const decorLine: Content = {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 42, y2: 0, lineWidth: 2, lineColor: p.ACCENT_SOFT }],
  };
  const eyebrow: Content = { text: "DEVIS".toUpperCase(), color: p.ACCENT, fontSize: 9, characterSpacing: 1.2, margin: [0, 0, 0, 8] };

  if (data.logoBase64) {
    return { stack: [eyebrow, { image: data.logoBase64, fit: [200, 72], margin: [0, 0, 0, 8] }, decorLine] };
  }
  return {
    stack: [eyebrow, { text: data.company?.name || "Entreprise", fontSize: 24, bold: true, color: p.TEXT_DARK, margin: [0, 0, 0, 8] }, decorLine],
  };
}

/**
 * Tableau de pièce.
 * @param aere  true = thème aéré (padding 11/10), false = thème normal (padding 7/6)
 */
function makeRoomTable(
  p: Palette,
  aere: boolean,
  roomName: string,
  items: Array<{ label: string; description: string | null; unit: string; quantity: number; unit_price_ht: number }>
): Content {
  const padV     = aere ? 11 : 7;   // padding vertical en-tête + items
  const padVItem = aere ? 10 : 6;

  return {
    table: {
      headerRows: 2,
      keepWithHeaderRows: 2,
      dontBreakRows: true,
      widths: ["*", 48, 52, 72, 78],
      body: [
        // Row 0 — room banner
        [
          {
            text: roomName,
            colSpan: 5,
            fillColor: p.BG_ROOM,
            color: p.TEXT_DARK,
            bold: true,
            fontSize: 11,
            margin: [12, padV, 12, padV],
            border: [true, true, true, true],
            borderColor: [p.ACCENT, p.BORDER, p.BORDER, p.BORDER],
          },
          {}, {}, {}, {},
        ],
        // Row 1 — column headers
        [
          { text: "Libellé",   style: "tableHeader" },
          { text: "Qté",       style: "tableHeader" },
          { text: "Unité",     style: "tableHeaderRight" },
          { text: "PU HT",     style: "tableHeaderRight" },
          { text: "Total HT",  style: "tableHeaderRight" },
        ],
        // Rows 2+ — items
        ...items.map((item) => [
          {
            stack: [
              { text: item.label, bold: true, color: p.TEXT_DARK },
              ...(item.description ? [{ text: item.description, color: p.TEXT_MUTED, fontSize: 9, margin: [0, 4, 0, 0] } as Content] : []),
            ],
          },
          { text: Number(item.quantity).toFixed(2), color: p.TEXT_DARK },
          { text: item.unit, alignment: "right", color: p.TEXT_DARK },
          { text: euro(item.unit_price_ht), alignment: "right", color: p.TEXT_DARK },
          { text: euro(item.quantity * item.unit_price_ht), alignment: "right", color: p.TEXT_DARK },
        ]),
      ],
    },
    layout: {
      fillColor: (rowIndex: number) => {
        if (rowIndex === 0) return p.BG_ROOM;
        if (rowIndex === 1) return p.BG_SECTION;
        return rowIndex % 2 === 0 ? p.BG_CARD : p.BG_ROW_ALT;
      },
      hLineColor: () => p.BORDER,
      vLineColor: () => p.BORDER,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      paddingLeft:   () => 12,
      paddingRight:  () => 12,
      paddingTop:    (i: number) => (i <= 1 ? padV : padVItem),
      paddingBottom: (i: number) => (i <= 1 ? padV : padVItem),
    },
    margin: [0, 0, 0, 14],
    unbreakable: false,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildQuotePdfDefinition(
  data: QuotePdfData,
  /** true = thème aéré (padding généreux), false/omis = thème normal (tableau serré) */
  aere = false
): TDocumentDefinitions {
  const p    = getPalette(data.colorMode);
  const aereB = aere;

  const groupedRooms = data.rooms
    .map((room) => ({ ...room, items: data.items.filter((i) => i.room_id === room.id) }))
    .filter((room) => room.items.length > 0);
  const unassignedItems = data.items.filter((i) => !i.room_id);

  const companyLines = [
    joinParts([data.company?.address_line1, data.company?.address_line2]) || "-",
    joinParts([data.company?.postal_code, data.company?.city, data.company?.country]) || "-",
    data.company?.phone || "-",
    data.company?.email || "-",
    `TVA : ${data.company?.vat_number || "-"}`,
  ];
  const customerLines = [
    joinParts([data.customer?.billing_address_line1, data.customer?.billing_address_line2]) || "-",
    joinParts([data.customer?.billing_postal_code, data.customer?.billing_city, data.customer?.billing_country]) || "-",
    data.customer?.phone || "-",
    data.customer?.email || "-",
  ];

  const roomSections: Content[] = [
    ...groupedRooms.map((room) => makeRoomTable(p, aereB, room.name, room.items)),
    ...(unassignedItems.length > 0 ? [makeRoomTable(p, aereB, "Sans pièce", unassignedItems)] : []),
  ];

  const notesAndTerms: Content[] = [];
  if (data.quote.notes || data.quote.terms) {
    notesAndTerms.push(makeSectionTitle(p, "Informations complémentaires"));
    if (data.quote.notes && data.quote.terms) {
      notesAndTerms.push(makeInfoCardsRow(p, makeTextCardCell(p, "Notes", data.quote.notes), makeTextCardCell(p, "Conditions", data.quote.terms)));
    } else if (data.quote.notes) {
      notesAndTerms.push(makeTextCardCell(p, "Notes", data.quote.notes));
    } else if (data.quote.terms) {
      notesAndTerms.push(makeTextCardCell(p, "Conditions", data.quote.terms));
    }
  }

  const content: Content[] = [
    // En-tête
    {
      columns: [
        { width: "*", ...makeCompanyIdentity(p, data) },
        {
          width: 180,
          table: {
            widths: ["*"],
            body: [[{
              stack: [
                { text: "DEVIS", color: p.ACCENT, fontSize: 9, characterSpacing: 1.2, margin: [0, 0, 0, 6] },
                { text: data.quote.quote_number, bold: true, fontSize: 16, color: p.TEXT_DARK, margin: [0, 0, 0, 10] },
                { columns: [{ text: "Date", color: p.TEXT_MUTED, width: "*" }, { text: data.quote.issue_date, bold: true, width: "auto" }], margin: [0, 0, 0, 4] },
                { columns: [{ text: "Validité", color: p.TEXT_MUTED, width: "*" }, { text: data.quote.valid_until || "-", bold: true, width: "auto" }] },
              ],
              fillColor: p.BG_SECTION,
              border: [true, true, true, true],
              borderColor: p.BORDER,
              margin: [10, 10, 10, 10],
            }]],
          },
          layout: "noBorders",
        },
      ],
      margin: [0, 0, 0, 18],
      unbreakable: true,
    },

    { text: data.quote.title, fontSize: 18, bold: true, color: p.TEXT_DARK, alignment: "center", margin: [0, 0, 0, 6] },

    ...(data.quote.description
      ? [{ text: data.quote.description, color: p.TEXT_MUTED, lineHeight: 1.4, alignment: "center", margin: [0, 0, 0, 18] } as Content]
      : [{ text: "", margin: [0, 0, 0, 8] } as Content]),

    makeInfoCardsRow(p, makeCardCell(p, "Entreprise", data.company?.name || "-", companyLines), makeCardCell(p, "Client", displayCustomerName(data.customer), customerLines)),

    makeSectionTitle(p, "Prestations", "Détail"),
    ...roomSections,

    // Totaux
    {
      columns: [
        { width: "*", text: "" },
        {
          width: 210,
          unbreakable: true,
          table: {
            widths: ["*", "auto"],
            body: [
              [
                { text: "Sous-total HT",             fillColor: p.BG_CARD,    color: p.TEXT_MUTED, margin: [10, 10, 10, 10] },
                { text: euro(data.quote.subtotal_ht), fillColor: p.BG_CARD,    color: p.TEXT_DARK, bold: true, alignment: "right", margin: [10, 10, 10, 10] },
              ],
              [
                { text: `TVA (${data.quote.tva_rate}%)`, fillColor: p.BG_CARD, color: p.TEXT_MUTED, margin: [10, 10, 10, 10] },
                { text: euro(data.quote.total_tva),       fillColor: p.BG_CARD, color: p.TEXT_DARK, bold: true, alignment: "right", margin: [10, 10, 10, 10] },
              ],
              [
                { text: "Total TTC",                fillColor: p.BG_SECTION, color: p.TEXT_DARK, bold: true,                              margin: [10, 12, 10, 12] },
                { text: euro(data.quote.total_ttc), fillColor: p.BG_SECTION, color: p.TEXT_DARK, bold: true, alignment: "right", fontSize: 14, margin: [10, 10, 10, 10] },
              ],
            ],
          },
          layout: {
            hLineColor: () => p.BORDER,
            vLineColor: () => p.BORDER,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
        },
      ],
      margin: [0, 8, 0, 18],
    },

    ...notesAndTerms,
  ];

  const styles: StyleDictionary = {
    tableHeader:      { bold: true, fontSize: 9, color: p.TEXT_MUTED },
    tableHeaderRight: { bold: true, fontSize: 9, color: p.TEXT_MUTED, alignment: "right" },
  };

  return {
    pageSize:    "A4",
    pageMargins: [28, 28, 28, 28],
    background:  () => ({ canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: p.BG_PAGE }] }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: data.company?.name || "", fontSize: 8, color: p.TEXT_MUTED, margin: [28, 0, 0, 0] },
        { text: `Page ${currentPage} / ${pageCount}`, alignment: "right", color: p.TEXT_MUTED, fontSize: 9, margin: [0, 0, 28, 12] },
      ],
    }),
    defaultStyle: { font: "Roboto", color: p.TEXT_DARK, fontSize: 10 },
    styles,
    info: {
      title:   `${data.quote.quote_number} - ${data.quote.title}`,
      author:  data.company?.name || "Entreprise",
      subject: "Devis",
    },
    content,
  };
}