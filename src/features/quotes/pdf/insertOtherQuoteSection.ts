import type { QuotePdfData } from "./quotePdfTypes";

export function getVisibleOtherSectionPosition(data: QuotePdfData) {
  const requestedPosition = data.quote.pdf_other_section_position;
  if (typeof requestedPosition !== "number") return null;

  const fullPosition = Math.max(
    0,
    Math.min(Math.trunc(requestedPosition), data.rooms.length),
  );
  const visibleRoomIds = new Set(
    data.items
      .map((item) => item.room_id)
      .filter((roomId): roomId is string => Boolean(roomId)),
  );

  return data.rooms
    .slice(0, fullPosition)
    .filter((room) => visibleRoomIds.has(room.id))
    .length;
}

export function insertOtherQuoteSection<T>(
  roomSections: T[],
  otherSection: T | null,
  requestedPosition: number | null | undefined,
) {
  if (!otherSection) return roomSections;

  const position = typeof requestedPosition === "number"
    ? Math.max(0, Math.min(Math.trunc(requestedPosition), roomSections.length))
    : roomSections.length;
  const sections = [...roomSections];
  sections.splice(position, 0, otherSection);
  return sections;
}
