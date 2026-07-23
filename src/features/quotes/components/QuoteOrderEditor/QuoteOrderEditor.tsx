import {
  Fragment,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { formatDisplayDate } from "../../../../lib/formatters";
import type {
  PdfTheme,
  QuoteItemInlineEdit,
  QuotePdfData,
  QuotePdfItem,
  QuoteRoomPageBreak,
} from "../../pdf/quotePdfTypes";
import {
  resolvePdfTheme,
  resolveQuoteRoomPageBreak,
} from "../../pdf/quotePdfTypes";
import "./QuoteOrderEditor.css";

const UNASSIGNED_ROOM_KEY = "__unassigned__";

type DragState =
  | { kind: "room"; id: string }
  | { kind: "item"; id: string; roomKey: string };

type QuoteItemEditDraft = {
  label: string;
  quantity: string;
  unitPriceHt: string;
};

type QuoteOrderEditorProps = {
  data: Omit<QuotePdfData, "logoBase64">;
  theme: string | null;
  colorMode: boolean | null;
  accentColor: string | null;
  saving: boolean;
  saveError: string | null;
  onCancel: () => void;
  onSave: (
    roomOrder: string[],
    itemOrder: string[],
    roomPageBreaks: Record<string, QuoteRoomPageBreak>,
    itemEdits: Record<string, QuoteItemInlineEdit>,
    otherSectionPosition: number | null,
  ) => void;
};

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function getCustomerName(data: QuotePdfData) {
  const customer = data.customer;
  if (!customer) return "Client";

  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Client"
  );
}

function getCustomerAddress(data: QuotePdfData) {
  const customer = data.customer;
  if (!customer) return [];

  return [
    customer.billing_address_line1,
    customer.billing_address_line2,
    [customer.billing_postal_code, customer.billing_city].filter(Boolean).join(" "),
    customer.billing_country,
  ].filter(Boolean) as string[];
}

function getCompanyAddress(data: QuotePdfData) {
  const company = data.company;
  if (!company) return [];

  return [
    company.address_line1,
    company.address_line2,
    [company.postal_code, company.city].filter(Boolean).join(" "),
    company.country,
  ].filter(Boolean) as string[];
}

function createInitialItemOrder(items: QuotePdfItem[]) {
  return items.reduce<Record<string, string[]>>((order, item) => {
    const roomKey = item.room_id || UNASSIGNED_ROOM_KEY;
    order[roomKey] = [...(order[roomKey] ?? []), item.id];
    return order;
  }, {});
}

function createInitialSectionOrder(data: QuotePdfData) {
  const roomIds = data.rooms.map((room) => room.id);
  const hasOtherSection = data.items.some((item) => !item.room_id);
  if (!hasOtherSection) return roomIds;

  const requestedPosition = data.quote.pdf_other_section_position;
  const position = typeof requestedPosition === "number"
    ? Math.max(0, Math.min(requestedPosition, roomIds.length))
    : roomIds.length;

  return [
    ...roomIds.slice(0, position),
    UNASSIGNED_ROOM_KEY,
    ...roomIds.slice(position),
  ];
}

function createInitialRoomPageBreaks(
  rooms: QuotePdfData["rooms"],
) {
  return Object.fromEntries(
    rooms.map((room) => [
      room.id,
      resolveQuoteRoomPageBreak(room.pdf_page_break),
    ]),
  ) as Record<string, QuoteRoomPageBreak>;
}

function createInitialItemEdits(items: QuotePdfItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        label: item.label,
        quantity: String(item.quantity),
        unitPriceHt: String(item.unit_price_ht),
      },
    ]),
  ) as Record<string, QuoteItemEditDraft>;
}

function parseEditableNumber(value: string) {
  if (!value.trim()) return null;
  const parsedValue = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function moveToInsertionIndex(values: string[], id: string, insertionIndex: number) {
  const sourceIndex = values.indexOf(id);
  if (sourceIndex < 0) return values;

  const nextValues = values.filter((value) => value !== id);
  const adjustedIndex = sourceIndex < insertionIndex
    ? insertionIndex - 1
    : insertionIndex;
  nextValues.splice(
    Math.max(0, Math.min(adjustedIndex, nextValues.length)),
    0,
    id,
  );
  return nextValues;
}

function moveByOffset(values: string[], id: string, offset: -1 | 1) {
  const sourceIndex = values.indexOf(id);
  const targetIndex = sourceIndex + offset;
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= values.length) {
    return values;
  }

  const nextValues = [...values];
  [nextValues[sourceIndex], nextValues[targetIndex]] = [
    nextValues[targetIndex],
    nextValues[sourceIndex],
  ];
  return nextValues;
}

function getEditedItemTotal(
  item: QuotePdfItem | undefined,
  itemEdits: Record<string, QuoteItemEditDraft>,
) {
  if (!item) return 0;
  const edit = itemEdits[item.id];
  const quantity = parseEditableNumber(edit?.quantity ?? String(item.quantity));
  const unitPrice = parseEditableNumber(
    edit?.unitPriceHt ?? String(item.unit_price_ht),
  );
  return (quantity ?? 0) * (unitPrice ?? 0);
}

function getRoomTotal(
  itemIds: string[],
  itemMap: Map<string, QuotePdfItem>,
  itemEdits: Record<string, QuoteItemEditDraft>,
) {
  return itemIds.reduce((total, itemId) => {
    const item = itemMap.get(itemId);
    return total + getEditedItemTotal(item, itemEdits);
  }, 0);
}

function getThemeLabel(theme: PdfTheme) {
  switch (theme) {
    case "aere":
      return "Aéré";
    case "compact":
      return "Compact";
    case "elegant":
      return "Élégant";
    default:
      return "Normal";
  }
}

export function QuoteOrderEditor({
  data,
  theme,
  colorMode,
  accentColor,
  saving,
  saveError,
  onCancel,
  onSave,
}: QuoteOrderEditorProps) {
  const resolvedTheme = resolvePdfTheme(theme);
  const [initialOrder] = useState(() => ({
    sections: createInitialSectionOrder(data),
    items: createInitialItemOrder(data.items),
    pageBreaks: createInitialRoomPageBreaks(data.rooms),
    itemEdits: createInitialItemEdits(data.items),
  }));
  const [sectionOrder, setSectionOrder] = useState(initialOrder.sections);
  const [itemOrder, setItemOrder] = useState(initialOrder.items);
  const [roomPageBreaks, setRoomPageBreaks] = useState(
    initialOrder.pageBreaks,
  );
  const [itemEdits, setItemEdits] = useState(initialOrder.itemEdits);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const activeDragRef = useRef<DragState | null>(null);
  const paperRef = useRef<HTMLElement | null>(null);
  const previousPositionsRef = useRef<Map<string, DOMRect> | null>(null);

  const roomMap = useMemo(
    () => new Map(data.rooms.map((room) => [room.id, room])),
    [data.rooms],
  );
  const itemMap = useMemo(
    () => new Map(data.items.map((item) => [item.id, item])),
    [data.items],
  );

  const initialSignature = JSON.stringify(initialOrder);
  const currentSignature = JSON.stringify({
    sections: sectionOrder,
    items: itemOrder,
    pageBreaks: roomPageBreaks,
    itemEdits,
  });
  const hasChanges = initialSignature !== currentSignature;
  const allSectionsCollapsed = sectionOrder.length > 0 &&
    sectionOrder.every((sectionId) => collapsedSections.has(sectionId));

  const liveTotals = useMemo(() => {
    return data.items.reduce(
      (totals, item) => {
        const itemTotal = getEditedItemTotal(item, itemEdits);
        const itemTvaRate = Number(item.tva_rate ?? data.quote.tva_rate ?? 0);
        return {
          subtotalHt: totals.subtotalHt + itemTotal,
          totalTva: totals.totalTva + itemTotal * itemTvaRate / 100,
        };
      },
      { subtotalHt: 0, totalTva: 0 },
    );
  }, [data.items, data.quote.tva_rate, itemEdits]);

  useLayoutEffect(() => {
    const previousPositions = previousPositionsRef.current;
    const paper = paperRef.current;
    previousPositionsRef.current = null;
    if (
      !previousPositions ||
      !paper ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    paper.querySelectorAll<HTMLElement>("[data-order-entity]").forEach((element) => {
      const entityId = element.dataset.orderEntity;
      const previousPosition = entityId
        ? previousPositions.get(entityId)
        : undefined;
      if (!previousPosition) return;

      const currentPosition = element.getBoundingClientRect();
      const deltaX = previousPosition.left - currentPosition.left;
      const deltaY = previousPosition.top - currentPosition.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

      element.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
  }, [itemOrder, sectionOrder]);

  const editorStyle = {
    "--quote-order-accent": accentColor || "#6f523c",
    "--quote-order-font-adjustment": `${data.quote.pdf_font_size_adjustment ?? 0}pt`,
  } as CSSProperties;

  function resetDragState() {
    activeDragRef.current = null;
    setDragState(null);
    setDropTarget(null);
  }

  function captureOrderPositions() {
    const paper = paperRef.current;
    if (!paper) return;

    previousPositionsRef.current = new Map(
      Array.from(
        paper.querySelectorAll<HTMLElement>("[data-order-entity]"),
        (element) => [
          element.dataset.orderEntity ?? "",
          element.getBoundingClientRect(),
        ],
      ).filter(([entityId]) => Boolean(entityId)) as Array<[string, DOMRect]>,
    );
  }

  function startPointerDrag(
    event: PointerEvent<HTMLElement>,
    nextDragState: DragState,
  ) {
    const target = event.target as HTMLElement;
    const usesDirectManipulation = event.pointerType !== "mouse";

    if (
      usesDirectManipulation &&
      !target.closest(".quote-order-editor__drag-handle")
    ) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeDragRef.current = nextDragState;
    setDragState(nextDragState);
  }

  function getPointerDropTarget(
    event: PointerEvent<HTMLElement>,
    activeDrag: DragState,
  ) {
    const element = document.elementFromPoint(
      event.clientX,
      event.clientY,
    ) as HTMLElement | null;

    if (activeDrag.kind === "room") {
      const zone = element?.closest<HTMLElement>("[data-room-drop-index]");
      const zoneIndex = Number(zone?.dataset.roomDropIndex);
      if (Number.isInteger(zoneIndex)) {
        return { key: `room:${zoneIndex}`, insertionIndex: zoneIndex };
      }

      const room = element?.closest<HTMLElement>("[data-room-order-index]");
      const roomIndex = Number(room?.dataset.roomOrderIndex);
      if (!room || !Number.isInteger(roomIndex)) return null;

      const bounds = room.getBoundingClientRect();
      const insertionIndex = roomIndex + (
        event.clientY > bounds.top + bounds.height / 2 ? 1 : 0
      );
      return { key: `room:${insertionIndex}`, insertionIndex };
    }

    const zone = element?.closest<HTMLElement>("[data-item-drop-index]");
    const zoneRoomKey = zone?.dataset.itemDropRoom;
    const zoneIndex = Number(zone?.dataset.itemDropIndex);
    if (
      zoneRoomKey === activeDrag.roomKey &&
      Number.isInteger(zoneIndex)
    ) {
      return {
        key: `item:${zoneRoomKey}:${zoneIndex}`,
        insertionIndex: zoneIndex,
        roomKey: zoneRoomKey,
      };
    }

    const item = element?.closest<HTMLElement>("[data-item-order-index]");
    const roomKey = item?.dataset.itemOrderRoom;
    const itemIndex = Number(item?.dataset.itemOrderIndex);
    if (
      !item ||
      roomKey !== activeDrag.roomKey ||
      !Number.isInteger(itemIndex)
    ) return null;

    const bounds = item.getBoundingClientRect();
    const insertionIndex = itemIndex + (
      event.clientY > bounds.top + bounds.height / 2 ? 1 : 0
    );
    return {
      key: `item:${roomKey}:${insertionIndex}`,
      insertionIndex,
      roomKey,
    };
  }

  function movePointerDrag(event: PointerEvent<HTMLElement>) {
    const activeDrag = activeDragRef.current;
    if (!activeDrag) return;
    event.preventDefault();
    const target = getPointerDropTarget(event, activeDrag);
    setDropTarget(target?.key ?? null);
  }

  function finishPointerDrag(event: PointerEvent<HTMLElement>) {
    const activeDrag = activeDragRef.current;
    if (!activeDrag) return;
    event.preventDefault();

    const target = getPointerDropTarget(event, activeDrag);
    if (target && activeDrag.kind === "room") {
      captureOrderPositions();
      setSectionOrder((current) =>
        moveToInsertionIndex(current, activeDrag.id, target.insertionIndex),
      );
    } else if (
      target &&
      activeDrag.kind === "item" &&
      "roomKey" in target &&
      typeof target.roomKey === "string"
    ) {
      const targetRoomKey = target.roomKey;
      captureOrderPositions();
      setItemOrder((current) => ({
        ...current,
        [targetRoomKey]: moveToInsertionIndex(
          current[targetRoomKey] ?? [],
          activeDrag.id,
          target.insertionIndex,
        ),
      }));
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetDragState();
  }

  function handleRoomKeyboard(
    event: KeyboardEvent<HTMLElement>,
    roomId: string,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    captureOrderPositions();
    setSectionOrder((current) =>
      moveByOffset(current, roomId, event.key === "ArrowUp" ? -1 : 1),
    );
  }

  function handleItemKeyboard(
    event: KeyboardEvent<HTMLElement>,
    itemId: string,
    roomKey: string,
  ) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    captureOrderPositions();
    setItemOrder((current) => ({
      ...current,
      [roomKey]: moveByOffset(
        current[roomKey] ?? [],
        itemId,
        event.key === "ArrowUp" ? -1 : 1,
      ),
    }));
  }

  function cancelEditing() {
    if (
      hasChanges &&
      !window.confirm("Annuler toutes les modifications du devis ?")
    ) return;
    onCancel();
  }

  function updateItemEdit(
    itemId: string,
    field: keyof QuoteItemEditDraft,
    value: string,
  ) {
    setValidationError(null);
    setItemEdits((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId],
        [field]: value,
      },
    }));
  }

  function toggleSectionCollapsed(sectionId: string) {
    setCollapsedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function toggleAllSectionsCollapsed() {
    setCollapsedSections(
      allSectionsCollapsed ? new Set() : new Set(sectionOrder),
    );
  }

  function saveOrder() {
    const normalizedItemEdits: Record<string, QuoteItemInlineEdit> = {};

    for (const item of data.items) {
      const edit = itemEdits[item.id];
      const label = edit?.label.trim() ?? "";
      const quantity = parseEditableNumber(edit?.quantity ?? "");
      const unitPriceHt = parseEditableNumber(edit?.unitPriceHt ?? "");

      if (!label) {
        setValidationError(`Le libellé de la ligne « ${item.label} » est obligatoire.`);
        return;
      }
      if (quantity === null || quantity < 0) {
        setValidationError(`La quantité de la ligne « ${label} » est invalide.`);
        return;
      }
      if (unitPriceHt === null || unitPriceHt < 0) {
        setValidationError(`Le prix de la ligne « ${label} » est invalide.`);
        return;
      }

      normalizedItemEdits[item.id] = {
        label,
        quantity,
        unit_price_ht: unitPriceHt,
      };
    }

    setValidationError(null);
    const roomOrder = sectionOrder.filter(
      (sectionId) => sectionId !== UNASSIGNED_ROOM_KEY,
    );
    const flattenedItemOrder = sectionOrder.flatMap(
      (sectionId) => itemOrder[sectionId] ?? [],
    );
    const otherSectionIndex = sectionOrder.indexOf(UNASSIGNED_ROOM_KEY);
    onSave(
      roomOrder,
      flattenedItemOrder,
      roomPageBreaks,
      normalizedItemEdits,
      otherSectionIndex >= 0 ? otherSectionIndex : null,
    );
  }

  function renderItemRows(roomKey: string) {
    const itemIds = itemOrder[roomKey] ?? [];

    return (
      <>
        {itemIds.map((itemId, index) => {
          const item = itemMap.get(itemId);
          if (!item) return null;
          const edit = itemEdits[itemId] ?? {
            label: item.label,
            quantity: String(item.quantity),
            unitPriceHt: String(item.unit_price_ht),
          };
          const itemTotal = getEditedItemTotal(item, itemEdits);

          return (
            <Fragment key={itemId}>
              <tr
                className={`quote-order-editor__item-drop-zone ${
                  dragState?.kind === "item" && dragState.roomKey === roomKey
                    ? "quote-order-editor__item-drop-zone--available"
                    : ""
                } ${
                  dropTarget === `item:${roomKey}:${index}`
                    ? "quote-order-editor__item-drop-zone--active"
                    : ""
                }`}
                data-item-drop-room={roomKey}
                data-item-drop-index={index}
              >
                <td colSpan={5}><span /></td>
              </tr>
              <tr
                className={`quote-order-editor__item-row ${
                  dragState?.kind === "item" && dragState.id === itemId
                    ? "quote-order-editor__item-row--dragging"
                    : ""
                }`}
                data-order-entity={`item:${itemId}`}
                data-item-order-room={roomKey}
                data-item-order-index={index}
                title="Glisser pour réordonner cette ligne"
                onPointerDown={(event) =>
                  startPointerDrag(event, {
                    kind: "item",
                    id: itemId,
                    roomKey,
                  })
                }
                onPointerMove={movePointerDrag}
                onPointerUp={finishPointerDrag}
                onPointerCancel={resetDragState}
              >
                <td>
                  <div className="quote-order-editor__designation">
                    <span
                      className="quote-order-editor__drag-handle"
                      role="button"
                      tabIndex={0}
                      aria-label={`Déplacer la ligne ${item.label}`}
                      title="Glisser pour réordonner cette ligne"
                      onKeyDown={(event) =>
                        handleItemKeyboard(event, itemId, roomKey)
                      }
                    >
                      ⠿
                    </span>
                    <span className="quote-order-editor__editable-designation">
                      <input
                        className="quote-order-editor__inline-input quote-order-editor__inline-input--label"
                        type="text"
                        value={edit.label}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateItemEdit(itemId, "label", event.currentTarget.value)
                        }
                        aria-label={`Libellé de la ligne ${item.label}`}
                      />
                      {item.description?.trim() ? <small>{item.description}</small> : null}
                    </span>
                  </div>
                </td>
                <td>
                  <input
                    className="quote-order-editor__inline-input quote-order-editor__inline-input--number"
                    type="text"
                    inputMode="decimal"
                    value={edit.quantity}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      updateItemEdit(itemId, "quantity", event.currentTarget.value)
                    }
                    aria-label={`Quantité de la ligne ${edit.label || item.label}`}
                  />
                </td>
                <td>{item.unit}</td>
                <td>
                  <input
                    className="quote-order-editor__inline-input quote-order-editor__inline-input--price"
                    type="text"
                    inputMode="decimal"
                    value={edit.unitPriceHt}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) =>
                      updateItemEdit(itemId, "unitPriceHt", event.currentTarget.value)
                    }
                    aria-label={`Prix unitaire HT de la ligne ${edit.label || item.label}`}
                  />
                </td>
                <td>{formatCurrency(itemTotal)}</td>
              </tr>
            </Fragment>
          );
        })}
        <tr
          className={`quote-order-editor__item-drop-zone ${
            dragState?.kind === "item" && dragState.roomKey === roomKey
              ? "quote-order-editor__item-drop-zone--available"
              : ""
          } ${
            dropTarget === `item:${roomKey}:${itemIds.length}`
              ? "quote-order-editor__item-drop-zone--active"
              : ""
          }`}
          data-item-drop-room={roomKey}
          data-item-drop-index={itemIds.length}
        >
          <td colSpan={5}><span /></td>
        </tr>
      </>
    );
  }

  function renderRoom(roomId: string) {
    const isOtherSection = roomId === UNASSIGNED_ROOM_KEY;
    const room = roomMap.get(roomId);
    if (!isOtherSection && !room) return null;
    const roomItems = itemOrder[roomId] ?? [];
    const roomName = isOtherSection ? "Autre" : room?.name ?? "";
    const isCollapsed = collapsedSections.has(roomId);
    const pageBreak = isOtherSection
      ? "auto"
      : roomPageBreaks[roomId] ?? "auto";

    return (
      <section
        key={roomId}
        className={`quote-order-editor__room ${
          dragState?.kind === "room" && dragState.id === roomId
            ? "quote-order-editor__room--dragging"
            : ""
        } ${
          isOtherSection ? "quote-order-editor__room--unassigned" : ""
        } quote-order-editor__room--page-${pageBreak}`}
        data-order-entity={`room:${roomId}`}
        data-room-order-index={sectionOrder.indexOf(roomId)}
      >
        {!isOtherSection && pageBreak === "before" ? (
          <div className="quote-order-editor__page-break-marker">
            Nouvelle page dans le PDF
          </div>
        ) : null}
        <header
          className="quote-order-editor__room-header"
          title="Glisser pour déplacer cette pièce avec toutes ses lignes"
          onPointerDown={(event) =>
            startPointerDrag(event, { kind: "room", id: roomId })
          }
          onPointerMove={movePointerDrag}
          onPointerUp={finishPointerDrag}
          onPointerCancel={resetDragState}
        >
          <span
            className="quote-order-editor__drag-handle quote-order-editor__drag-handle--room"
            role="button"
            tabIndex={0}
            aria-label={`Déplacer la section ${roomName}`}
            title="Glisser pour déplacer cette pièce avec toutes ses lignes"
            onKeyDown={(event) => handleRoomKeyboard(event, roomId)}
          >
            ⠿
          </span>
          <h3>{roomName}</h3>
          {!isOtherSection ? (
            <label
              className="quote-order-editor__page-break-control"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span>Pagination</span>
              <select
                value={pageBreak}
                onChange={(event) => {
                  const nextPageBreak = resolveQuoteRoomPageBreak(
                    event.currentTarget.value,
                  );
                  setRoomPageBreaks((current) => ({
                    ...current,
                    [roomId]: nextPageBreak,
                  }));
                }}
                aria-label={`Pagination PDF de la pièce ${roomName}`}
              >
                <option value="auto">Automatique</option>
                <option value="keep">Garder ensemble</option>
                <option value="before">Nouvelle page</option>
              </select>
            </label>
          ) : null}
          <span className="quote-order-editor__room-total">
            {formatCurrency(getRoomTotal(roomItems, itemMap, itemEdits))}
          </span>
          <button
            type="button"
            className="quote-order-editor__collapse-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => toggleSectionCollapsed(roomId)}
            aria-expanded={!isCollapsed}
            aria-controls={`quote-order-editor-section-${roomId}`}
            aria-label={`${isCollapsed ? "Déplier" : "Replier"} la section ${roomName}`}
            title={isCollapsed ? "Déplier la section" : "Replier la section"}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        </header>
        <div
          id={`quote-order-editor-section-${roomId}`}
          className={`quote-order-editor__room-content ${
            isCollapsed ? "quote-order-editor__room-content--collapsed" : ""
          }`}
          aria-hidden={isCollapsed}
        >
          <div>
            <table>
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Qté</th>
                  <th>Unité</th>
                  <th>PU HT</th>
                  <th>Total HT</th>
                </tr>
              </thead>
              <tbody>{renderItemRows(roomId)}</tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`quote-order-editor quote-order-editor--${resolvedTheme} ${
        colorMode === false ? "quote-order-editor--monochrome" : ""
      }`}
      style={editorStyle}
      aria-labelledby="quote-order-editor-title"
    >
      <header className="quote-order-editor__toolbar">
        <div>
          <p>Mode organisation · modèle {getThemeLabel(resolvedTheme)}</p>
          <h2 id="quote-order-editor-title">Organiser le devis</h2>
          <span>
            Glissez les pièces et les lignes, ou cliquez sur un libellé, une
            quantité ou un prix pour le modifier. Les changements ne sont
            enregistrés qu’après validation.
          </span>
        </div>
        <div className="quote-order-editor__toolbar-actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={toggleAllSectionsCollapsed}
            disabled={sectionOrder.length === 0}
          >
            {allSectionsCollapsed ? "Tout déplier" : "Tout replier"}
          </Button>
          <span
            className={`quote-order-editor__change-status ${
              hasChanges ? "quote-order-editor__change-status--dirty" : ""
            }`}
          >
            {hasChanges ? "Modifications en attente" : "Aucune modification"}
          </span>
          <Button type="button" variant="secondary" onClick={cancelEditing}>
            Annuler
          </Button>
          <Button
            type="button"
            onClick={saveOrder}
            disabled={saving || !hasChanges}
          >
            {saving ? "Enregistrement..." : "Enregistrer et vérifier le PDF"}
          </Button>
        </div>
      </header>

      {validationError || saveError ? (
        <ErrorMessage message={validationError || saveError || ""} />
      ) : null}

      <div className="quote-order-editor__workspace">
        <p className="quote-order-editor__workspace-hint">
          Glissez une pièce ou une ligne. Sur mobile, partez de la poignée
          <strong> ⠿</strong> afin de conserver le défilement vertical. Le
          menu Pagination contrôle les coupures dans le PDF ; les champs sont
          directement modifiables.
        </p>

        <article ref={paperRef} className="quote-order-editor__paper">
          <header className="quote-order-editor__document-header">
            <div className="quote-order-editor__company">
              {data.company?.logo_url ? (
                <img src={data.company.logo_url} alt="" />
              ) : null}
              <div>
                <p>DEVIS</p>
                <h1>{data.company?.name || "Entreprise"}</h1>
                {getCompanyAddress(data).map((line) => <span key={line}>{line}</span>)}
                {data.company?.vat_number ? <span>TVA {data.company.vat_number}</span> : null}
              </div>
            </div>

            <div className="quote-order-editor__quote-meta">
              <p>DEVIS</p>
              <strong>{data.quote.quote_number}</strong>
              <span>Date : {formatDisplayDate(data.quote.issue_date, "—")}</span>
              <span>
                Validité : {formatDisplayDate(data.quote.valid_until, "—")}
              </span>
            </div>

            <div className="quote-order-editor__client">
              <p>CLIENT</p>
              <strong>{getCustomerName(data)}</strong>
              {getCustomerAddress(data).map((line) => <span key={line}>{line}</span>)}
              {data.customer?.email ? <span>{data.customer.email}</span> : null}
            </div>
          </header>

          <div className="quote-order-editor__document-title">
            <h2>{data.quote.title}</h2>
            {data.quote.description?.trim() ? <p>{data.quote.description}</p> : null}
          </div>

          <div className="quote-order-editor__rooms">
            {sectionOrder.map((roomId, index) => (
              <Fragment key={roomId}>
                <div
                  className={`quote-order-editor__room-drop-zone ${
                    dragState?.kind === "room"
                      ? "quote-order-editor__room-drop-zone--available"
                      : ""
                  } ${
                    dropTarget === `room:${index}`
                      ? "quote-order-editor__room-drop-zone--active"
                      : ""
                  }`}
                  data-room-drop-index={index}
                >
                  <span />
                </div>
                {renderRoom(roomId)}
              </Fragment>
            ))}
            <div
              className={`quote-order-editor__room-drop-zone ${
                dragState?.kind === "room"
                  ? "quote-order-editor__room-drop-zone--available"
                  : ""
              } ${
                dropTarget === `room:${sectionOrder.length}`
                  ? "quote-order-editor__room-drop-zone--active"
                  : ""
              }`}
              data-room-drop-index={sectionOrder.length}
            >
              <span />
            </div>
          </div>

          <div className="quote-order-editor__totals">
            <dl>
              <div>
                <dt>Sous-total HT</dt>
                <dd>{formatCurrency(liveTotals.subtotalHt)}</dd>
              </div>
              <div>
                <dt>TVA ({data.quote.tva_rate} %)</dt>
                <dd>{formatCurrency(liveTotals.totalTva)}</dd>
              </div>
              <div>
                <dt>Total TTC</dt>
                <dd>
                  {formatCurrency(liveTotals.subtotalHt + liveTotals.totalTva)}
                </dd>
              </div>
            </dl>
          </div>

          {data.quote.notes || data.quote.terms ? (
            <footer className="quote-order-editor__document-footer">
              {data.quote.notes ? (
                <section>
                  <h3>Notes</h3>
                  <p>{data.quote.notes}</p>
                </section>
              ) : null}
              {data.quote.terms ? (
                <section>
                  <h3>Conditions</h3>
                  <p>{data.quote.terms}</p>
                </section>
              ) : null}
            </footer>
          ) : null}
        </article>
      </div>
    </section>
  );
}
