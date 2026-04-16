import type {
  Content,
  StyleDictionary,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";

import type { QuotePdfData } from "./quotePdfTypes";

const ACCENT_COLOR = "#8e7452";
const ACCENT_COLOR_SOFT = "#a88f6c";
const BORDER_SOFT = "#d8cbb8";
const TEXT_DARK = "#2f2a24";
const TEXT_MUTED = "#6e6254";
const BG_PAGE = "#f8f5ef";
const BG_CARD = "#fffdf9";
const BG_SECTION = "#efe7db";
const BG_ROOM = "#f6efe4";
const BG_ROW_ALT = "#f3ede3";

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

function makeCardCell(label: string, title: string, lines: string[]): TableCell {
  return {
    stack: [
      {
        text: label.toUpperCase(),
        color: ACCENT_COLOR,
        fontSize: 9,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 6],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 38,
            y2: 0,
            lineWidth: 1.5,
            lineColor: ACCENT_COLOR_SOFT,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text: title,
        bold: true,
        fontSize: 14,
        color: TEXT_DARK,
        margin: [0, 0, 0, 8],
      },
      ...lines.filter(Boolean).map((line) => ({
        text: line,
        color: TEXT_DARK,
        fontSize: 10,
        margin: [0, 0, 0, 4],
      })),
    ],
    fillColor: BG_CARD,
    border: [true, true, true, true],
    borderColor: BORDER_SOFT,
    margin: [10, 10, 10, 10],
    valign: "top",
  };
}

function makeSectionTitle(title: string, kicker?: string): Content {
  return {
    stack: [
      kicker
        ? {
            text: kicker.toUpperCase(),
            color: ACCENT_COLOR,
            fontSize: 9,
            characterSpacing: 1.2,
            margin: [0, 0, 0, 4],
          }
        : undefined,
      {
        text: title,
        fontSize: 16,
        bold: true,
        color: TEXT_DARK,
      },
    ].filter(Boolean) as Content[],
    margin: [0, 0, 0, 10],
  };
}

function makeInfoCardsRow(left: TableCell, right: TableCell): Content {
  return {
    table: {
      widths: ["*", 14, "*"],
      body: [
        [
          left,
          {
            border: [false, false, false, false],
            stack: [
              {
                canvas: [
                  {
                    type: "line",
                    x1: 7,
                    y1: 0,
                    x2: 7,
                    y2: 84,
                    lineWidth: 1,
                    lineColor: ACCENT_COLOR,
                  },
                ],
                margin: [0, 14, 0, 14],
              },
            ],
          },
          right,
        ],
      ],
    },
    layout: {
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
    margin: [0, 0, 0, 18],
    unbreakable: true,
  };
}

function makeTextCardCell(label: string, text: string): TableCell {
  return {
    stack: [
      {
        text: label.toUpperCase(),
        color: ACCENT_COLOR,
        fontSize: 9,
        characterSpacing: 1.2,
        margin: [0, 0, 0, 6],
      },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 36,
            y2: 0,
            lineWidth: 1.5,
            lineColor: ACCENT_COLOR_SOFT,
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        text,
        color: TEXT_DARK,
        fontSize: 10,
        lineHeight: 1.35,
      },
    ],
    fillColor: BG_CARD,
    border: [true, true, true, true],
    borderColor: BORDER_SOFT,
    margin: [12, 12, 12, 12],
    valign: "top",
  };
}

function makeRoomTable(
  roomName: string,
  items: Array<{
    label: string;
    description: string | null;
    unit: string;
    quantity: number;
    unit_price_ht: number;
  }>
): Content {
  return {
    table: {
      headerRows: 2,
      keepWithHeaderRows: 2,
      dontBreakRows: true,
      widths: ["*", 48, 52, 72, 78],
      body: [
        // Ligne 0 : titre de la pièce sur toute la largeur
        [
          {
            text: roomName,
            colSpan: 5,
            fillColor: BG_ROOM,
            color: TEXT_DARK,
            bold: true,
            fontSize: 12,
            margin: [12, 12, 12, 12],
            border: [true, true, true, true],
            borderColor: [ACCENT_COLOR, ACCENT_COLOR, ACCENT_COLOR, ACCENT_COLOR],
          },
          {},
          {},
          {},
          {},
        ],
        // Ligne 1 : headers des colonnes
        [
          { text: "Libellé", style: "tableHeader" },
          { text: "Unité", style: "tableHeader" },
          { text: "Qté", style: "tableHeaderRight" },
          { text: "PU HT", style: "tableHeaderRight" },
          { text: "Total HT", style: "tableHeaderRight" },
        ],
        // Lignes items
        ...items.map((item) => [
          {
            stack: [
              { text: item.label, bold: true, color: TEXT_DARK },
              ...(item.description
                ? [
                    {
                      text: item.description,
                      color: TEXT_MUTED,
                      fontSize: 9,
                      margin: [0, 4, 0, 0],
                    } as Content,
                  ]
                : []),
            ],
          },
          { text: item.unit, color: TEXT_DARK },
          {
            text: Number(item.quantity).toFixed(2),
            alignment: "right",
            color: TEXT_DARK,
          },
          {
            text: euro(item.unit_price_ht),
            alignment: "right",
            color: TEXT_DARK,
          },
          {
            text: euro(item.quantity * item.unit_price_ht),
            alignment: "right",
            color: TEXT_DARK,
          },
        ]),
      ],
    },
    layout: {
      fillColor: (rowIndex: number) => {
        if (rowIndex === 0) return BG_ROOM;    // titre pièce
        if (rowIndex === 1) return BG_SECTION; // header colonnes
        return rowIndex % 2 === 0 ? BG_CARD : BG_ROW_ALT;
      },
      hLineColor: () => ACCENT_COLOR,
      vLineColor: () => ACCENT_COLOR,
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: (i: number) => (i <= 1 ? 11 : 10),
      paddingBottom: (i: number) => (i <= 1 ? 11 : 10),
    },
    margin: [0, 0, 0, 14],
    unbreakable: false,
  };
}

export function buildQuotePdfDefinition(data: QuotePdfData): TDocumentDefinitions {
  const groupedRooms = data.rooms
    .map((room) => ({
      ...room,
      items: data.items.filter((item) => item.room_id === room.id),
    }))
    .filter((room) => room.items.length > 0);

  const unassignedItems = data.items.filter((item) => !item.room_id);

  const companyLines = [
    joinParts([data.company?.address_line1, data.company?.address_line2]) || "-",
    joinParts([
      data.company?.postal_code,
      data.company?.city,
      data.company?.country,
    ]) || "-",
    data.company?.phone || "-",
    data.company?.email || "-",
    `TVA : ${data.company?.vat_number || "-"}`,
  ];

  const customerLines = [
    joinParts([
      data.customer?.billing_address_line1,
      data.customer?.billing_address_line2,
    ]) || "-",
    joinParts([
      data.customer?.billing_postal_code,
      data.customer?.billing_city,
      data.customer?.billing_country,
    ]) || "-",
    data.customer?.phone || "-",
    data.customer?.email || "-",
  ];

  const roomSections: Content[] = groupedRooms.map((room) =>
    makeRoomTable(room.name, room.items)
  );

  if (unassignedItems.length > 0) {
    roomSections.push(makeRoomTable("Sans pièce", unassignedItems));
  }

  const notesAndTerms: Content[] = [];

  if (data.quote.notes || data.quote.terms) {
    notesAndTerms.push(makeSectionTitle("Informations complémentaires"));

    if (data.quote.notes && data.quote.terms) {
      notesAndTerms.push(
        makeInfoCardsRow(
          makeTextCardCell("Notes", data.quote.notes),
          makeTextCardCell("Conditions", data.quote.terms)
        )
      );
    } else if (data.quote.notes) {
      notesAndTerms.push(makeTextCardCell("Notes", data.quote.notes));
    } else if (data.quote.terms) {
      notesAndTerms.push(makeTextCardCell("Conditions", data.quote.terms));
    }
  }

  const content: Content[] = [
    {
      columns: [
        {
          width: "*",
          stack: [
            {
              text: "Devis premium".toUpperCase(),
              color: ACCENT_COLOR,
              fontSize: 9,
              characterSpacing: 1.2,
              margin: [0, 0, 0, 8],
            },
            {
              text: data.company?.name || "Entreprise",
              fontSize: 24,
              bold: true,
              color: TEXT_DARK,
              margin: [0, 0, 0, 8],
            },
            {
              canvas: [
                {
                  type: "line",
                  x1: 0,
                  y1: 0,
                  x2: 42,
                  y2: 0,
                  lineWidth: 2,
                  lineColor: ACCENT_COLOR_SOFT,
                },
              ],
            },
          ],
        },
        {
          width: 180,
          table: {
            widths: ["*"],
            body: [
              [
                {
                  stack: [
                    {
                      text: "DEVIS",
                      color: ACCENT_COLOR,
                      fontSize: 9,
                      characterSpacing: 1.2,
                      margin: [0, 0, 0, 6],
                    },
                    {
                      text: data.quote.quote_number,
                      bold: true,
                      fontSize: 16,
                      color: TEXT_DARK,
                      margin: [0, 0, 0, 10],
                    },
                    {
                      columns: [
                        { text: "Date", color: TEXT_MUTED, width: "*" },
                        {
                          text: data.quote.issue_date,
                          bold: true,
                          width: "auto",
                        },
                      ],
                      margin: [0, 0, 0, 4],
                    },
                    {
                      columns: [
                        { text: "Validité", color: TEXT_MUTED, width: "*" },
                        {
                          text: data.quote.valid_until || "-",
                          bold: true,
                          width: "auto",
                        },
                      ],
                    },
                  ],
                  fillColor: BG_SECTION,
                  border: [true, true, true, true],
                  borderColor: BORDER_SOFT,
                  margin: [10, 10, 10, 10],
                },
              ],
            ],
          },
          layout: "noBorders",
        },
      ],
      margin: [0, 0, 0, 18],
      unbreakable: true,
    },

    {
      text: data.quote.title,
      fontSize: 18,
      bold: true,
      color: TEXT_DARK,
      margin: [0, 0, 0, 6],
    },

    ...(data.quote.description
      ? [
          {
            text: data.quote.description,
            color: TEXT_MUTED,
            lineHeight: 1.4,
            margin: [0, 0, 0, 18],
          } as Content,
        ]
      : [{ text: "", margin: [0, 0, 0, 8] } as Content]),

    makeInfoCardsRow(
      makeCardCell("Entreprise", data.company?.name || "-", companyLines),
      makeCardCell("Client", displayCustomerName(data.customer), customerLines)
    ),

    makeSectionTitle("Prestations", "Détail"),
    ...roomSections,

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
                {
                  text: "Sous-total HT",
                  fillColor: BG_CARD,
                  margin: [10, 10, 10, 10],
                },
                {
                  text: euro(data.quote.subtotal_ht),
                  fillColor: BG_CARD,
                  bold: true,
                  alignment: "right",
                  margin: [10, 10, 10, 10],
                },
              ],
              [
                {
                  text: `TVA (${data.quote.tva_rate}%)`,
                  fillColor: BG_CARD,
                  margin: [10, 10, 10, 10],
                },
                {
                  text: euro(data.quote.total_tva),
                  fillColor: BG_CARD,
                  bold: true,
                  alignment: "right",
                  margin: [10, 10, 10, 10],
                },
              ],
              [
                {
                  text: "Total TTC",
                  fillColor: BG_SECTION,
                  bold: true,
                  margin: [10, 10, 10, 10],
                },
                {
                  text: euro(data.quote.total_ttc),
                  fillColor: BG_SECTION,
                  bold: true,
                  alignment: "right",
                  fontSize: 14,
                  margin: [10, 10, 10, 10],
                },
              ],
            ],
          },
          layout: {
            hLineColor: () => "#e7ddd0",
            vLineColor: () => BORDER_SOFT,
          },
        },
      ],
      margin: [0, 8, 0, 18],
    },

    ...notesAndTerms,
  ];

  const styles: StyleDictionary = {
    tableHeader: {
      bold: true,
      fontSize: 9,
      color: TEXT_MUTED,
    },
    tableHeaderRight: {
      bold: true,
      fontSize: 9,
      color: TEXT_MUTED,
      alignment: "right",
    },
  };

  return {
    pageSize: "A4",
    pageMargins: [28, 28, 28, 28],
    background: () => ({
      canvas: [
        {
          type: "rect",
          x: 0,
          y: 0,
          w: 595.28,
          h: 841.89,
          color: BG_PAGE,
        },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: "" },
        {
          text: `Page ${currentPage} / ${pageCount}`,
          alignment: "right",
          color: TEXT_MUTED,
          fontSize: 9,
          margin: [0, 0, 28, 12],
        },
      ],
    }),
    defaultStyle: {
      font: "Roboto",
      color: TEXT_DARK,
      fontSize: 10,
    },
    styles,
    info: {
      title: `${data.quote.quote_number} - ${data.quote.title}`,
      author: data.company?.name || "Entreprise",
      subject: "Devis",
    },
    content,
  };
}