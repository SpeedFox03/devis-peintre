import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import type { QuotePdfData } from "./quotePdfTypes";
import { formatDisplayDate } from "../../../lib/formatters";
import {
  ELEGANT_PAINT_TOP,
  ELEGANT_PAINT_BOTLEFT,
  ELEGANT_PAINT_TOP_RECT,
  ELEGANT_PAINT_BOTLEFT_RECT,
} from "./elegantPaintAssets";
import { ELEGANT_FONT_SERIF, ELEGANT_FONT_SCRIPT } from "./elegantFontAssets";

// ─── Thème « Élégant » ──────────────────────────────────────────────────────────
//
// Reproduit fidèlement la maquette papier crème MomentD.Art :
//   • fond crème (#e1ded9) + vraies textures de peinture (impasto) découpées de la
//     maquette et détourées en alpha (voir elegantPaintAssets / src/docs) ;
//   • titres en serif Playfair Display, formule de politesse en script Great Vibes ;
//   • bronze réservé au numéro, au total et au pied de page ; libellés en gris taupe.
//
// Le logo uploadé est utilisé tel quel ; aucun logo n'est dessiné.

const SERIF = ELEGANT_FONT_SERIF;
const SCRIPT = ELEGANT_FONT_SCRIPT;

// ─── Palette ────────────────────────────────────────────────────────────────────

type ElegantPalette = {
  ACCENT: string; // bronze (numéro, total, pied de page)
  ACCENT_SOFT: string;
  BORDER: string; // filets de tableau
  TEXT_TITLE: string; // quasi-noir des grands titres (DEVIS)
  TEXT_DARK: string; // noms / intitulés serif
  TEXT_MUTED: string; // libellés, descriptions, valeurs secondaires
  BG_PAGE: string; // fond de page (doit matcher le fond des découpes de peinture)
  BG_PANEL: string; // panneaux beige (badge, entête tableau, totaux)
  BG_CARD: string; // cartes DE / POUR (crème, légèrement plus clair que la page)
  PAINT: boolean; // afficher les textures de peinture
};

const PALETTE_COLOR: ElegantPalette = {
  ACCENT: "#7b461f",
  ACCENT_SOFT: "#b89a83",
  BORDER: "#d8c9bd",
  TEXT_TITLE: "#211914",
  TEXT_DARK: "#2b211a",
  TEXT_MUTED: "#6f4c35",
  BG_PAGE: "#f4ebe1",
  BG_PANEL: "#eee2d6",
  BG_CARD: "#faf5ef",
  PAINT: true,
};

const PALETTE_BW: ElegantPalette = {
  ACCENT: "#1a1a1a",
  ACCENT_SOFT: "#555555",
  BORDER: "#d0d0d0",
  TEXT_TITLE: "#111111",
  TEXT_DARK: "#1c1c1c",
  TEXT_MUTED: "#666666",
  BG_PAGE: "#ffffff",
  BG_PANEL: "#f0f0f0",
  BG_CARD: "#ffffff",
  PAINT: false,
};

function getElegantPalette(colorMode?: boolean | null, accentColor?: string | null): ElegantPalette {
  const base = colorMode === true ? PALETTE_COLOR : PALETTE_BW;
  if (colorMode === true && accentColor) {
    return { ...base, ACCENT: accentColor };
  }
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;

/** Espaces fines/insécables d'Intl → espace normale (glyphes garantis dans les polices). */
function normalizeSpaces(value: string) {
  return value.replace(/[\u202f\u00a0]/g, " ");
}

/** Formatage monétaire à la française : 1 790,20 € */
function euro(value: number) {
  const formatted = new Intl.NumberFormat("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
  return `${normalizeSpaces(formatted)} €`;
}

function quantity(value: number) {
  return normalizeSpaces(
    Number(value).toLocaleString("fr-BE", { maximumFractionDigits: 2 })
  );
}

function displayUnit(unit: string) {
  return unit.replace(/\bm(?:2|\^2)\b/gi, "m²");
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
  return parts.filter(Boolean).join(" · ");
}

// ─── Icônes (SVG, traits accent) ────────────────────────────────────────────────

function icon(path: string, p: ElegantPalette, size = 12): Content {
  return {
    svg: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${p.ACCENT}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`,
    width: size,
  };
}

const ICON_CALENDAR = '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>';
const ICON_CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const ICON_MAIL = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';
const ICON_PHONE = '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>';
const ICON_GLOBE = '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>';

/** Ligne « icône + libellé : valeur » du bloc dates (alignée à droite). */
function iconMetaRow(p: ElegantPalette, iconPath: string, label: string, value: string): Content {
  return {
    columns: [
      { width: "*", text: "" },
      {
        width: "auto",
        table: {
          body: [[
            { ...icon(iconPath, p, 12), border: [false, false, false, false], margin: [0, 0, 7, 0], valign: "middle" },
            {
              border: [false, false, false, false],
              valign: "middle",
              text: [
                { text: `${label} : `, color: p.TEXT_MUTED, fontSize: 9.5 },
                { text: value, color: p.TEXT_DARK, fontSize: 9.5, bold: true },
              ],
            },
          ]],
        },
        layout: {
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
          hLineWidth: () => 0, vLineWidth: () => 0,
        },
      },
    ],
    margin: [0, 0, 0, 6],
  };
}

// ─── En-tête ────────────────────────────────────────────────────────────────────

function makeHeaderLeft(data: QuotePdfData, p: ElegantPalette): Content {
  if (data.logoBase64) {
    // Logo agrandi, ancré à gauche (occupe tout l'espace disponible).
    return {
      width: "*",
      stack: [{
        image: data.logoBase64,
        fit: [270, 162],
        alignment: "left",
        // Compense la marge transparente du logo afin de centrer son contenu
        // visible entre le bord de page et le coup de pinceau.
        relativePosition: { x: -55, y: -25 },
      }],
    };
  }
  return {
    width: "*",
    stack: [
      { text: data.company?.name || "Entreprise", font: SERIF, fontSize: 30, color: p.TEXT_DARK, alignment: "center" },
      {
        columns: [
          { width: "*", text: "" },
          { width: "auto", canvas: [{ type: "line", x1: 0, y1: 0, x2: 72, y2: 0, lineWidth: 1.5, lineColor: p.ACCENT_SOFT }] },
          { width: "*", text: "" },
        ],
        margin: [0, 12, 0, 0],
      },
    ],
  };
}

function makeHeaderRight(data: QuotePdfData, p: ElegantPalette): Content {
  return {
    width: 234,
    stack: [
      {
        text: "DEVIS",
        font: SERIF,
        fontSize: 32,
        characterSpacing: 4,
        color: p.TEXT_TITLE,
        alignment: "right",
        margin: [0, 0, 0, 11],
      },
      {
        table: {
          widths: ["*"],
          body: [[{
            text: data.quote.quote_number,
            font: SERIF,
            color: p.ACCENT,
            fontSize: 16,
            characterSpacing: 1,
            alignment: "center",
            fillColor: p.BG_PANEL,
            border: [false, false, false, false],
            margin: [12, 8, 12, 8],
          }]],
        },
        layout: "noBorders",
        margin: [72, 0, 0, 12],
      },
      iconMetaRow(p, ICON_CALENDAR, "Émise le", formatDisplayDate(data.quote.issue_date, "-")),
      ...(data.quote.valid_until ? [iconMetaRow(p, ICON_CLOCK, "Échéance", formatDisplayDate(data.quote.valid_until, "-"))] : []),
    ],
  };
}

// ─── Bloc DE / POUR (cartes encadrées, style structuré) ─────────────────────────

function makePartyCard(p: ElegantPalette, label: string, title: string, lines: string[]): TableCell {
  return {
    stack: [
      { text: label.toUpperCase(), color: p.ACCENT, fontSize: 9, characterSpacing: 2.5, margin: [0, 0, 0, 5] },
      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 26, y2: 0, lineWidth: 1.5, lineColor: p.ACCENT_SOFT }],
        margin: [0, 0, 0, 8],
      },
      { text: title, font: SERIF, fontSize: 15, color: p.TEXT_DARK, margin: [0, 0, 0, 6] },
      ...lines.filter(Boolean).map((line) => ({
        text: line, color: p.TEXT_MUTED, fontSize: 9.5, lineHeight: 1.35, margin: [0, 0, 0, 1],
      } as Content)),
    ],
    fillColor: p.BG_CARD,
    border: [true, true, true, true],
    borderColor: p.BORDER,
    margin: [14, 11, 14, 11],
    valign: "top",
  };
}

function makePartiesRow(p: ElegantPalette, left: TableCell, right: TableCell): Content {
  return {
    table: {
      widths: ["*", 16, "*"],
      body: [[
        left,
        {
          border: [false, false, false, false],
          stack: [{
            canvas: [{ type: "line", x1: 8, y1: 0, x2: 8, y2: 74, lineWidth: 1, lineColor: p.ACCENT_SOFT }],
            margin: [0, 10, 0, 10],
          }],
        },
        right,
      ]],
    },
    layout: {
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      hLineWidth: () => 0, vLineWidth: () => 0,
    },
    margin: [0, 0, 0, 14],
    unbreakable: true,
  };
}

// ─── Tableau des prestations ───────────────────────────────────────────────────

type ItemLite = { label: string; description: string | null; unit: string; quantity: number; unit_price_ht: number };

function headerCell(text: string, p: ElegantPalette, align: "left" | "center" | "right" = "left"): TableCell {
  return {
    text: text.toUpperCase(),
    style: "colHeader",
    color: p.TEXT_MUTED,
    alignment: align,
    fillColor: p.BG_PANEL,
    margin: [10, 9, 10, 9],
    noWrap: true,
  };
}

function buildItemsTable(
  p: ElegantPalette,
  groups: Array<{ name: string | null; items: ItemLite[] }>
): Content {
  const body: TableCell[][] = [];

  body.push([
    headerCell("Description", p, "left"),
    headerCell("Quantité", p, "center"),
    headerCell("Prix (HTVA)", p, "center"),
    headerCell("Total (HTVA)", p, "right"),
  ]);

  for (const group of groups) {
    if (group.name) {
      body.push([
        {
          text: group.name,
          colSpan: 4,
          bold: true,
          fontSize: 9,
          characterSpacing: 1.5,
          color: p.ACCENT,
          margin: [12, 13, 12, 6],
        },
        {}, {}, {},
      ]);
    }
    for (const item of group.items) {
      body.push([
        {
          stack: [
            { text: item.label, font: SERIF, fontSize: 12, color: p.TEXT_DARK },
            ...(item.description
              ? [{ text: item.description, color: p.TEXT_MUTED, fontSize: 8.5, lineHeight: 1.35, margin: [0, 4, 0, 0] } as Content]
              : []),
          ],
          margin: [10, 8, 10, 8],
        },
        {
          text: `${quantity(item.quantity)}${item.unit ? `  ${displayUnit(item.unit)}` : ""}`,
          alignment: "center", color: p.TEXT_DARK, fontSize: 10, margin: [4, 8, 4, 8], valign: "top", noWrap: true,
        },
        { text: euro(item.unit_price_ht), alignment: "center", color: p.TEXT_DARK, fontSize: 10, margin: [4, 8, 4, 8], valign: "top", noWrap: true },
        {
          text: euro(item.quantity * item.unit_price_ht),
          alignment: "right",
          color: p.TEXT_DARK,
          fontSize: Math.abs(item.quantity * item.unit_price_ht) >= 10_000 ? 9.5 : 10.5,
          bold: true,
          margin: [8, 8, 10, 8],
          valign: "top",
          noWrap: true,
        },
      ]);
    }
  }

  const lastRow = body.length;

  return {
    table: {
      headerRows: 1,
      widths: ["*", 74, 82, 92],
      body,
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === lastRow ? 0 : 0.7),
      vLineWidth: () => 0,
      hLineColor: () => p.BORDER,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 0],
  };
}

// ─── Totaux ───────────────────────────────────────────────────────────────────

function makeTotals(data: QuotePdfData, p: ElegantPalette): Content {
  const row = (label: string, value: string): TableCell[] => [
    { text: label, color: p.TEXT_MUTED, fontSize: 10, margin: [18, 7, 8, 7] },
    { text: value, alignment: "right", color: p.TEXT_DARK, fontSize: 10.5, margin: [8, 7, 18, 7], noWrap: true },
  ];

  const totalTtcFontSize = Math.abs(data.quote.total_ttc) >= 1_000_000
    ? 16
    : Math.abs(data.quote.total_ttc) >= 100_000
      ? 18
      : Math.abs(data.quote.total_ttc) >= 10_000
        ? 20
        : 24;

  return {
    columns: [
      { width: "*", text: "" },
      {
        width: 292,
        table: {
          widths: ["*", "auto"],
          body: [
            row("Sous-total HTVA", euro(data.quote.subtotal_ht)),
            row(`TVA (${data.quote.tva_rate}%)`, euro(data.quote.total_tva)),
            [
              { text: "TOTAL TTC", font: SERIF, fontSize: 15, color: p.TEXT_DARK, margin: [18, 10, 8, 12], valign: "middle" },
              {
                text: euro(data.quote.total_ttc),
                font: SERIF,
                alignment: "right",
                fontSize: totalTtcFontSize,
                color: p.ACCENT,
                margin: [8, 5, 18, 9],
                noWrap: true,
              },
            ],
          ],
        },
        layout: {
          fillColor: () => p.BG_PANEL,
          hLineWidth: (i: number) => (i === 2 ? 1.2 : 0),
          vLineWidth: () => 0,
          hLineColor: () => p.ACCENT_SOFT,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
      },
    ],
    margin: [0, 8, 0, 0],
    unbreakable: true,
  };
}

// ─── Notes / Conditions ─────────────────────────────────────────────────────────

function makeNotesTerms(data: QuotePdfData, p: ElegantPalette): Content[] {
  if (!data.quote.notes && !data.quote.terms) return [];
  const cols: Content[] = [];
  const card = (label: string, text: string): Content => ({
    width: "*",
    stack: [
      { text: label.toUpperCase(), color: p.TEXT_MUTED, fontSize: 9, characterSpacing: 2, margin: [0, 0, 0, 6] },
      { text, color: p.TEXT_DARK, fontSize: 9.5, lineHeight: 1.45 },
    ],
  });
  if (data.quote.notes) cols.push(card("Notes", data.quote.notes));
  if (data.quote.terms) {
    if (cols.length > 0) cols.push({ width: 20, text: "" });
    cols.push(card("Conditions", data.quote.terms));
  }
  return [{ columns: cols, margin: [0, 24, 0, 0] } as Content];
}

// ─── Pied de page ───────────────────────────────────────────────────────────────

function makeFooter(data: QuotePdfData, p: ElegantPalette): Content {
  const parts: Content[] = [];
  const divider = (): Content => ({
    width: "auto",
    canvas: [{ type: "line", x1: 0, y1: 1, x2: 0, y2: 11, lineWidth: 0.6, lineColor: p.BORDER }],
    margin: [11, 0, 11, 0],
  });

  const addItem = (iconPath: string, value: string) => {
    if (parts.length > 0) parts.push(divider());
    parts.push({ ...icon(iconPath, p, 11), margin: [0, 1, 6, 0] });
    parts.push({ width: "auto", text: value, color: p.TEXT_MUTED, fontSize: 8.5 });
  };

  if (data.company?.email) addItem(ICON_MAIL, data.company.email);
  if (data.company?.phone) addItem(ICON_PHONE, data.company.phone);
  if (data.company?.website) addItem(ICON_GLOBE, data.company.website);

  return {
    margin: [40, 0, 40, 0],
    stack: [
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: PAGE_W - 80, y2: 0, lineWidth: 0.7, lineColor: p.BORDER }], margin: [0, 0, 0, 10] },
      {
        columns: [
          { width: "*", columns: parts.length > 0 ? parts : [{ text: "" }] },
          { width: "auto", text: "Merci pour votre confiance", font: SCRIPT, color: p.ACCENT, fontSize: 20, margin: [0, -4, 0, 0] },
        ],
      },
    ],
  };
}

// ─── Fond : crème + textures de peinture ────────────────────────────────────────
//
// Les coups de pinceau restent dans les marges (jamais sur le texte) : celui du haut
// uniquement en tête de la 1re page (via `background`), celui du bas uniquement en pied
// de la dernière page (via `footer`, cf. makeFooter). Rien sur les pages intermédiaires.

function makeBackground(p: ElegantPalette, withTopPaint: boolean): Content {
  const layers: Content[] = [
    { canvas: [{ type: "rect", x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: p.BG_PAGE }] },
  ];
  if (p.PAINT && withTopPaint) {
    layers.push({
      image: ELEGANT_PAINT_TOP,
      width: ELEGANT_PAINT_TOP_RECT.w,
      absolutePosition: { x: ELEGANT_PAINT_TOP_RECT.x, y: ELEGANT_PAINT_TOP_RECT.y },
    });
  }
  return layers as unknown as Content;
}

/** Coup de pinceau du coin bas-gauche, positionné en absolu (placé depuis le footer). */
function bottomPaintLayer(): Content {
  return {
    image: ELEGANT_PAINT_BOTLEFT,
    width: ELEGANT_PAINT_BOTLEFT_RECT.w,
    absolutePosition: { x: ELEGANT_PAINT_BOTLEFT_RECT.x, y: ELEGANT_PAINT_BOTLEFT_RECT.y },
  };
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function buildElegantQuotePdfDefinition(data: QuotePdfData): TDocumentDefinitions {
  const p = getElegantPalette(data.colorMode, data.accentColor);

  const groupedRooms = data.rooms
    .map((room) => ({ name: room.name as string | null, items: data.items.filter((i) => i.room_id === room.id) }))
    .filter((room) => room.items.length > 0);
  const unassignedItems = data.items.filter((i) => !i.room_id);

  const onlyUnassigned = groupedRooms.length === 0;
  const groups: Array<{ name: string | null; items: ItemLite[] }> = [
    ...groupedRooms.map((r) => ({
      name: groupedRooms.length === 1 && unassignedItems.length === 0 ? null : r.name,
      items: r.items,
    })),
    ...(unassignedItems.length > 0
      ? [{ name: onlyUnassigned ? null : "Sans pièce", items: unassignedItems }]
      : []),
  ];

  const companyLines = [
    joinParts([data.company?.address_line1, data.company?.address_line2]),
    joinParts([data.company?.postal_code, data.company?.city, data.company?.country]),
    data.company?.vat_number ? `TVA : ${data.company.vat_number}` : null,
  ].filter(Boolean) as string[];

  const customerLines = [
    joinParts([data.customer?.billing_address_line1, data.customer?.billing_address_line2]),
    joinParts([data.customer?.billing_postal_code, data.customer?.billing_city, data.customer?.billing_country]),
    data.customer?.email || null,
    data.customer?.phone || null,
  ].filter(Boolean) as string[];

  const content: Content[] = [
    {
      columns: [makeHeaderLeft(data, p), makeHeaderRight(data, p)],
      margin: [0, 0, 0, 12],
    },

    makePartiesRow(
      p,
      makePartyCard(p, "De", data.company?.name || "-", companyLines),
      makePartyCard(p, "Pour", displayCustomerName(data.customer), customerLines),
    ),

    ...(data.quote.title
      ? [{ text: data.quote.title, font: SERIF, fontSize: 17, color: p.TEXT_DARK, alignment: "center", margin: [0, 0, 0, data.quote.description ? 5 : 20] } as Content]
      : []),
    ...(data.quote.description
      ? [{ text: data.quote.description, color: p.TEXT_MUTED, fontSize: 10, lineHeight: 1.45, alignment: "center", margin: [0, 0, 0, 20] } as Content]
      : []),

    buildItemsTable(p, groups),

    makeTotals(data, p),

    ...makeNotesTerms(data, p),

    // Peinture du bas : placée en absolu (coin bas-gauche), en dernier élément → elle
    // se pose sur la dernière page uniquement, sans consommer d'espace ni sur le texte.
    ...(p.PAINT ? [bottomPaintLayer()] : []),
  ];

  const styles: StyleDictionary = {
    colHeader: { fontSize: 8, bold: true, characterSpacing: 0.5 },
  };

  return {
    pageSize: "A4",
    pageMargins: [40, 34, 40, 48],
    // Peinture du haut : 1re page seulement.
    background: (currentPage: number) => makeBackground(p, currentPage === 1),
    footer: (currentPage: number, pageCount: number) => ({
      stack: [
        makeFooter(data, p),
        ...(pageCount > 1
          ? [{ text: `Page ${currentPage} / ${pageCount}`, alignment: "center", color: p.TEXT_MUTED, fontSize: 7.5, margin: [0, 4, 0, 0] } as Content]
          : []),
      ],
      margin: [0, 8, 0, 0],
    }),
    defaultStyle: { font: "Roboto", color: p.TEXT_DARK, fontSize: 10 },
    styles,
    info: {
      title: `${data.quote.quote_number} - ${data.quote.title}`,
      author: data.company?.name || "Entreprise",
      subject: "Devis",
    },
    content,
  };
}
