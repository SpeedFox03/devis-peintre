import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import type { QuotePdfData } from "./quotePdfTypes";

// ─── Palettes ─────────────────────────────────────────────────────────────────

type CompactPalette = {
  ACCENT:       string;
  ACCENT_SOFT:  string;
  BORDER:       string;
  TEXT_DARK:    string;
  TEXT_MUTED:   string;
  TEXT_ROOM:    string;
  BG_PAGE:      string;
  BG_HEADER:    string;
  BG_ROW_ALT:   string;
  BG_TOTAL:     string;
  BG_TOTAL_TTC: string;
};

const PALETTE_COLOR: CompactPalette = {
  ACCENT:       "#8e7452",
  ACCENT_SOFT:  "#a88f6c",
  BORDER:       "#d8cbb8",
  TEXT_DARK:    "#2f2a24",
  TEXT_MUTED:   "#6e6254",
  TEXT_ROOM:    "#6b4f2e",
  BG_PAGE:      "#f8f5ef",
  BG_HEADER:    "#f6efe4",
  BG_ROW_ALT:   "#f3ede3",
  BG_TOTAL:     "#fffdf9",
  BG_TOTAL_TTC: "#efe7db",
};

const PALETTE_BW: CompactPalette = {
  ACCENT:       "#1a1a1a",
  ACCENT_SOFT:  "#555555",
  BORDER:       "#d8d8d8",
  TEXT_DARK:    "#111111",
  TEXT_MUTED:   "#666666",
  TEXT_ROOM:    "#666666",
  BG_PAGE:      "#ffffff",
  BG_HEADER:    "#f2f2f2",
  BG_ROW_ALT:   "#f8f8f8",
  BG_TOTAL:     "#ffffff",
  BG_TOTAL_TTC: "#ebebeb",
};

function getCompactPalette(colorMode?: boolean | null): CompactPalette {
  return colorMode === true ? PALETTE_COLOR : PALETTE_BW;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function euro(value: number) {
  return `${Number(value).toFixed(2)} \u20ac`;
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

// ─── Blocks ───────────────────────────────────────────────────────────────────

function makeCompanyColumn(data: QuotePdfData, cp: CompactPalette): Content {
  const companyBlock = [
    joinParts([data.company?.address_line1, data.company?.address_line2]),
    joinParts([data.company?.postal_code, data.company?.city, data.company?.country]),
    data.company?.phone,
    data.company?.email,
    data.company?.vat_number ? `TVA : ${data.company.vat_number}` : null,
  ].filter(Boolean) as string[];

  const infoLines: Content[] = companyBlock.map((line) => ({
    text: line, fontSize: 8, color: cp.TEXT_MUTED, margin: [0, 0, 0, 1],
  }));

  if (data.logoBase64) {
    return { width: "*", stack: [{ image: data.logoBase64, fit: [140, 48], margin: [0, 0, 0, 6] }, ...infoLines] };
  }
  return {
    width: "*",
    stack: [
      { text: data.company?.name || "Entreprise", bold: true, fontSize: 13, color: cp.TEXT_DARK, margin: [0, 0, 0, 3] },
      ...infoLines,
    ],
  };
}

function makeHeader(data: QuotePdfData, cp: CompactPalette): Content {
  const customerBlock = [
    displayCustomerName(data.customer),
    joinParts([data.customer?.billing_address_line1, data.customer?.billing_address_line2]),
    joinParts([data.customer?.billing_postal_code, data.customer?.billing_city, data.customer?.billing_country]),
    data.customer?.phone,
    data.customer?.email,
  ].filter(Boolean) as string[];

  return {
    columns: [
      makeCompanyColumn(data, cp),
      {
        width: 130, alignment: "center" as const,
        stack: [
          { text: "DEVIS", fontSize: 8, characterSpacing: 2, color: cp.ACCENT, margin: [0, 0, 0, 3] },
          { text: data.quote.quote_number, bold: true, fontSize: 14, color: cp.TEXT_DARK, margin: [0, 0, 0, 4] },
          { text: `Date : ${data.quote.issue_date}`, fontSize: 8, color: cp.ACCENT_SOFT, margin: [0, 0, 0, 2] },
          data.quote.valid_until
            ? { text: `Validité : ${data.quote.valid_until}`, fontSize: 8, color: cp.ACCENT_SOFT }
            : { text: "" },
        ],
      },
      {
        width: 160, alignment: "right" as const,
        stack: [
          { text: "CLIENT", fontSize: 7, characterSpacing: 1.5, color: cp.ACCENT, margin: [0, 0, 0, 3] },
          ...customerBlock.map((line, i) => ({
            text: line, fontSize: i === 0 ? 9 : 8, bold: i === 0,
            color: i === 0 ? cp.TEXT_DARK : cp.TEXT_MUTED, margin: [0, 0, 0, 1],
          })),
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

function makeRule(cp: CompactPalette, accent = false, weight = 0.5): Content {
  return {
    canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: weight, lineColor: accent ? cp.ACCENT : cp.BORDER }],
    margin: [0, 4, 0, 6],
  };
}

function makeTitleBlock(data: QuotePdfData, cp: CompactPalette): Content {
  const items: Content[] = [
    { text: data.quote.title, fontSize: 11, bold: true, color: cp.TEXT_DARK, margin: [0, 0, 0, 2] },
  ];
  if (data.quote.description) {
    items.push({ text: data.quote.description, fontSize: 8, color: cp.ACCENT_SOFT, lineHeight: 1.3 });
  }
  return {
    columns: [{ width: "*", stack: items, alignment: "center" as const }],
    margin: [0, 0, 0, 8],
  };
}

function makeColumnHeaders(cp: CompactPalette): Content {
  // Margins match exactly the item cell margins so columns align perfectly
  return {
    table: {
      widths: ["*", 36, 40, 60, 66],
      body: [[
        { text: "Libellé",  style: "colHeader",      margin: [4, 5, 4, 5] },
        { text: "Qté",      style: "colHeaderCenter", margin: [2, 5, 2, 5] },
        { text: "Unité",    style: "colHeaderRight",  margin: [2, 5, 4, 5] },
        { text: "PU HT",    style: "colHeaderRight",  margin: [2, 5, 4, 5] },
        { text: "Total HT", style: "colHeaderRight",  margin: [2, 5, 4, 5] },
      ]],
    },
    layout: {
      fillColor:     () => cp.BG_HEADER,
      hLineWidth:    (i: number) => (i === 0 || i === 1 ? 0.5 : 0),
      hLineColor:    () => cp.ACCENT,
      vLineWidth:    () => 0,
      paddingLeft:   () => 0,
      paddingRight:  () => 0,
      paddingTop:    () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 0],
  };
}

function makeCompactRoomTable(
  cp: CompactPalette,
  roomName: string,
  items: Array<{ label: string; description: string | null; unit: string; quantity: number; unit_price_ht: number }>,
  isFirst: boolean
): Content {
  const body: unknown[][] = [
    [
      {
        text: roomName.toUpperCase(),
        colSpan: 5,
        fontSize: 7,
        bold: true,
        characterSpacing: 1,
        color: cp.TEXT_ROOM,
        fillColor: cp.BG_HEADER,
        border: [true, false, false, false],
        borderColor: [cp.ACCENT, cp.BORDER, cp.BORDER, cp.BORDER],
        margin: [6, 4, 4, 4],
      },
      {}, {}, {}, {},
    ],
    ...items.flatMap((item) => {
      const mainRow = [
        { text: item.label,                               fontSize: 8.5, bold: true, color: cp.TEXT_DARK,  border: [false, false, false, false], margin: [4, 3, 4, item.description ? 1 : 3] },
        { text: Number(item.quantity).toFixed(2),         fontSize: 8,   alignment: "center", color: cp.TEXT_DARK,  border: [false, false, false, false], margin: [2, 3, 2, item.description ? 1 : 3] },
        { text: item.unit,                                fontSize: 8,   alignment: "right",  color: cp.TEXT_MUTED, border: [false, false, false, false], margin: [2, 3, 4, item.description ? 1 : 3] },
        { text: euro(item.unit_price_ht),                 fontSize: 8,   alignment: "right",  color: cp.TEXT_DARK,  border: [false, false, false, false], margin: [2, 3, 4, item.description ? 1 : 3] },
        { text: euro(item.quantity * item.unit_price_ht), fontSize: 8.5, bold: true, alignment: "right", color: cp.TEXT_DARK, border: [false, false, false, false], margin: [2, 3, 4, item.description ? 1 : 3] },
      ];
      if (item.description) {
        return [mainRow, [
          { text: item.description, fontSize: 7.5, color: cp.TEXT_MUTED, colSpan: 5, border: [false, false, false, false], margin: [4, 0, 4, 3] },
          {}, {}, {}, {},
        ]];
      }
      return [mainRow];
    }),
  ];

  return {
    table: {
      widths: ["*", 36, 40, 60, 66],
      body: body as unknown as import("pdfmake/interfaces").TableCell[][],
    },
    layout: {
      fillColor:     (rowIndex: number) => rowIndex === 0 ? cp.BG_HEADER : rowIndex % 2 === 0 ? cp.BG_ROW_ALT : cp.BG_PAGE,
      hLineWidth:    () => 0,
      vLineWidth:    () => 0,
      paddingLeft:   () => 0,
      paddingRight:  () => 0,
      paddingTop:    () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, isFirst ? 0 : 6, 0, 0],
  };
}

function makeTotals(data: QuotePdfData, cp: CompactPalette): Content {
  return {
    columns: [
      { width: "*", text: "" },
      {
        width: 200,
        stack: [
          makeRule(cp, false, 0.5),
          {
            table: {
              widths: ["*", "auto"],
              body: [
                [
                  { text: "Sous-total HT",             fontSize: 8, color: cp.TEXT_MUTED, fillColor: cp.BG_TOTAL, border: [false, false, false, false], margin: [6, 4, 6, 4] },
                  { text: euro(data.quote.subtotal_ht), fontSize: 8, bold: true, alignment: "right", color: cp.TEXT_DARK, fillColor: cp.BG_TOTAL, border: [false, false, false, false], margin: [6, 4, 6, 4] },
                ],
                [
                  { text: `TVA (${data.quote.tva_rate}%)`, fontSize: 8, color: cp.TEXT_MUTED, fillColor: cp.BG_TOTAL, border: [false, false, false, false], margin: [6, 4, 6, 4] },
                  { text: euro(data.quote.total_tva),       fontSize: 8, bold: true, alignment: "right", color: cp.TEXT_DARK, fillColor: cp.BG_TOTAL, border: [false, false, false, false], margin: [6, 4, 6, 4] },
                ],
              ],
            },
            layout: {
              hLineColor: () => cp.BORDER,
              hLineWidth: (i: number) => (i === 0 || i === 2 ? 0.5 : 0),
              vLineWidth: () => 0,
              paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
            },
          },
          makeRule(cp, true, 1.5),
          {
            table: {
              widths: ["*", "auto"],
              body: [[
                { text: "TOTAL TTC",               fontSize: 9, bold: true, fillColor: cp.BG_TOTAL_TTC, color: cp.TEXT_DARK, border: [true, false, false, false], borderColor: [cp.ACCENT, cp.BORDER, cp.BORDER, cp.BORDER], margin: [6, 6, 6, 6] },
                { text: euro(data.quote.total_ttc), fontSize: 12, bold: true, alignment: "right", fillColor: cp.BG_TOTAL_TTC, color: cp.TEXT_DARK, border: [false, false, false, false], margin: [6, 4, 6, 4] },
              ]],
            },
            layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
          },
        ],
      },
    ],
    margin: [0, 8, 0, 10],
  };
}

function makeNotesTerms(data: QuotePdfData, cp: CompactPalette): Content[] {
  if (!data.quote.notes && !data.quote.terms) return [];
  const blocks: Content[] = [makeRule(cp, false, 0.5)];
  const cols: Content[] = [];
  if (data.quote.notes) {
    cols.push({ width: "*", stack: [
      { text: "NOTES",          fontSize: 7, characterSpacing: 1, color: cp.ACCENT, margin: [0, 0, 0, 3] },
      { text: data.quote.notes, fontSize: 8, color: cp.TEXT_DARK, lineHeight: 1.35 },
    ]});
  }
  if (data.quote.terms) {
    if (cols.length > 0) cols.push({ width: 12, text: "" });
    cols.push({ width: "*", stack: [
      { text: "CONDITIONS",     fontSize: 7, characterSpacing: 1, color: cp.ACCENT, margin: [0, 0, 0, 3] },
      { text: data.quote.terms, fontSize: 8, color: cp.TEXT_DARK, lineHeight: 1.35 },
    ]});
  }
  blocks.push({ columns: cols } as Content);
  return blocks;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function buildCompactQuotePdfDefinition(data: QuotePdfData): TDocumentDefinitions {
  const cp = getCompactPalette(data.colorMode);

  const groupedRooms = data.rooms
    .map((room) => ({ ...room, items: data.items.filter((item) => item.room_id === room.id) }))
    .filter((room) => room.items.length > 0);
  const unassignedItems = data.items.filter((item) => !item.room_id);

  const roomSections: Content[] = groupedRooms.map((room, i) =>
    makeCompactRoomTable(cp, room.name, room.items, i === 0)
  );
  if (unassignedItems.length > 0) {
    roomSections.push(makeCompactRoomTable(cp, "Sans pièce", unassignedItems, groupedRooms.length === 0));
  }

  const styles: StyleDictionary = {
    colHeader:       { fontSize: 7.5, bold: true, color: cp.TEXT_DARK },
    colHeaderCenter: { fontSize: 7.5, bold: true, color: cp.TEXT_DARK, alignment: "center" },
    colHeaderRight:  { fontSize: 7.5, bold: true, color: cp.TEXT_DARK, alignment: "right" },
  };

  const content: Content[] = [
    makeHeader(data, cp),
    makeRule(cp, true, 1.5),
    makeTitleBlock(data, cp),
    makeColumnHeaders(cp),
    ...roomSections,
    makeTotals(data, cp),
    ...makeNotesTerms(data, cp),
  ];

  return {
    pageSize:    "A4",
    pageMargins: [28, 24, 28, 32],
    background:  () => ({ canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: cp.BG_PAGE }] }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: data.company?.name || "", fontSize: 7, color: cp.ACCENT_SOFT, margin: [28, 0, 0, 0] },
        { text: `Page ${currentPage} / ${pageCount}`, alignment: "right", color: cp.ACCENT_SOFT, fontSize: 7, margin: [0, 0, 28, 0] },
      ],
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: "Roboto", color: cp.TEXT_DARK, fontSize: 9, lineHeight: 1.2 },
    styles,
    info: {
      title:   `${data.quote.quote_number} - ${data.quote.title}`,
      author:  data.company?.name || "Entreprise",
      subject: "Devis",
    },
    content,
  };
}