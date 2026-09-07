import { MAX_ITEMS, MAX_ROOMS } from "../shared/constants.ts";
import {
  isConfidence,
  roundMoney,
  toOptionalPositiveInteger,
  toOptionalPositiveNumber,
} from "../shared/numbers.ts";
import {
  cleanNullableText,
  cleanText,
  normalizeSearchText,
  uniqueKey,
} from "../shared/text.ts";
import type {
  CatalogService,
  ExistingRoom,
  ModelDraft,
  ResolvedDraftIssue,
  ResolvedDraftRoom,
  TradeSlug,
} from "../shared/types.ts";
import {
  buildGenericPaintingSuggestion,
  getCategorySurfaceType,
  getServiceSurfaceType,
  isSurfaceSpecificPaintingService,
  resolveExplicitSurface,
} from "../trades/peintre/surface.ts";
import {
  getDefaultClarificationQuestion,
  resolveAmbiguities,
} from "./ambiguities.ts";
import {
  buildDescription,
  removeRoomQualifier,
  resolveCatalogSuggestion,
} from "./catalog-suggestion.ts";

/**
 * Confronte la proposition du modèle au devis et au catalogue réels.
 *
 * Tout ce qui n'est pas certain devient une question bloquante plutôt qu'une
 * ligne appliquée : c'est ici que se joue la fiabilité de l'assistant.
 */
export function resolveDraft({
  quoteId,
  transcript,
  modelDraft,
  rooms,
  services,
  categories,
  trade,
}: {
  quoteId: string;
  transcript: string;
  modelDraft: ModelDraft;
  rooms: ExistingRoom[];
  services: CatalogService[];
  categories: string[];
  trade: TradeSlug | null;
}) {
  // Le repli sur une prestation générique quand le support est incertain est
  // réglé pour la peinture. Les autres métiers signalent l'ambiguïté sans
  // substituer de prestation, tant que leurs propres règles n'existent pas.
  const usePaintingSurfaceRules = trade === null || trade === "peintre";
  const issues: ResolvedDraftIssue[] = [];
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const serviceById = new Map(
    services.map((service) => [service.id, service]),
  );
  const roomKeys = new Set<string>();
  const modelRoomKeyMap = new Map<string, string>();

  const rawRooms = Array.isArray(modelDraft.rooms)
    ? modelDraft.rooms.slice(0, MAX_ROOMS)
    : [];

  const resolvedRooms = rawRooms.flatMap<ResolvedDraftRoom>(
    (rawRoom, index) => {
      if (!rawRoom || typeof rawRoom !== "object") return [];
      const source = rawRoom as Record<string, unknown>;
      const requestedKey = cleanText(source.key, 80) || `room-${index + 1}`;
      const key = uniqueKey(requestedKey, roomKeys);
      modelRoomKeyMap.set(requestedKey, key);
      modelRoomKeyMap.set(key, key);
      const action: ResolvedDraftRoom["action"] = source.action === "reuse"
        ? "reuse"
        : "create";
      const existingRoomId = cleanNullableText(source.existing_room_id, 80);

      if (action === "reuse") {
        const existingRoom = existingRoomId
          ? roomById.get(existingRoomId)
          : null;
        if (!existingRoom) {
          issues.push({
            message:
              "Une pièce existante proposée par l'assistant n'appartient pas au devis.",
            blocking: true,
          });
          return [];
        }

        return [
          {
            key,
            action,
            existing_room_id: existingRoom.id,
            name: existingRoom.name,
            notes: existingRoom.notes,
          },
        ];
      }

      const name = cleanText(source.name, 120);
      if (!name) {
        issues.push({
          message: "Une nouvelle pièce proposée n'a pas de nom.",
          blocking: true,
        });
        return [];
      }

      return [
        {
          key,
          action,
          existing_room_id: null,
          name,
          notes: cleanNullableText(source.notes, 500),
        },
      ];
    },
  );

  const validRoomKeys = new Set(resolvedRooms.map((room) => room.key));
  const rawItems = Array.isArray(modelDraft.items)
    ? modelDraft.items.slice(0, MAX_ITEMS)
    : [];

  const resolvedItems = rawItems.map((rawItem, index) => {
    const itemKey = `item-${index + 1}`;
    const source = rawItem && typeof rawItem === "object"
      ? (rawItem as Record<string, unknown>)
      : {};
    const catalogSuggestion = resolveCatalogSuggestion(
      source.catalog_suggestion,
      index,
      categories,
    );
    const serviceId = cleanNullableText(source.catalog_service_id, 80);
    let service = serviceId ? serviceById.get(serviceId) : null;
    const requestedRoomKey = cleanNullableText(source.room_key, 80);
    const resolvedRoomKey = requestedRoomKey
      ? modelRoomKeyMap.get(requestedRoomKey) ?? requestedRoomKey
      : null;
    const roomKey = resolvedRoomKey && validRoomKeys.has(resolvedRoomKey)
      ? resolvedRoomKey
      : null;
    const roomName = roomKey
      ? resolvedRooms.find((room) => room.key === roomKey)?.name ?? null
      : null;
    catalogSuggestion.name = removeRoomQualifier(
      catalogSuggestion.name,
      roomName,
    );

    if (requestedRoomKey && !roomKey) {
      issues.push({
        message: `La pièce de la ligne ${
          index + 1
        } n'a pas pu être résolue ; la ligne sera sans pièce.`,
        blocking: false,
      });
    }

    const requestedCoats = toOptionalPositiveInteger(source.requested_coats);
    const ambiguities = resolveAmbiguities(source.ambiguities);
    const clarificationQuestion = ambiguities.length > 0
      ? cleanNullableText(source.clarification_question, 300) ??
        getDefaultClarificationQuestion(ambiguities, roomName)
      : null;
    const surfaceType = resolveExplicitSurface(
      source.surface_type,
      source.surface_source_excerpt,
      transcript,
    );
    const proposedService = service;
    const proposedServiceSurface = proposedService
      ? getServiceSurfaceType(proposedService)
      : null;
    const proposedSuggestionSurface = getCategorySurfaceType(
      catalogSuggestion.category,
    );
    const surfaceMismatch = Boolean(
      usePaintingSurfaceRules &&
        proposedService &&
        isSurfaceSpecificPaintingService(proposedService) &&
        (!surfaceType ||
          (proposedServiceSurface &&
            proposedServiceSurface !== surfaceType)),
    );
    const suggestionSurfaceMismatch = Boolean(
      usePaintingSurfaceRules &&
        !proposedService &&
        proposedSuggestionSurface &&
        (!surfaceType || proposedSuggestionSurface !== surfaceType),
    );

    if (surfaceMismatch || suggestionSurfaceMismatch) {
      service = null;
      Object.assign(
        catalogSuggestion,
        buildGenericPaintingSuggestion({
          surfaceType,
          requestedCoats,
          coatsAreAmbiguous: ambiguities.includes("coats"),
          fallbackUnit: proposedService?.default_unit ??
            catalogSuggestion.unit,
        }),
      );
    }

    let quantity = toOptionalPositiveNumber(source.quantity);

    if (
      (service?.default_unit === "forfait" ||
        (!service && catalogSuggestion.unit === "forfait")) &&
      quantity === null
    ) {
      quantity = 1;
    }

    const pricingBasis = String(
      service?.default_metadata?.pricing_basis ?? "finished_surface",
    );
    if (
      quantity !== null &&
      requestedCoats !== null &&
      requestedCoats > 1 &&
      pricingBasis === "per_coat"
    ) {
      quantity *= requestedCoats;
    }

    if (!service) {
      issues.push({
        message: `Aucune prestation certaine du catalogue pour « ${
          catalogSuggestion.name || `ligne ${index + 1}`
        } ».`,
        blocking: true,
        code: "missing_catalog_service",
        item_key: itemKey,
      });
    } else if (quantity === null) {
      issues.push({
        message: `La quantité manque pour « ${service.name} ».`,
        blocking: true,
        code: "missing_quantity",
        item_key: itemKey,
      });
    }

    if (ambiguities.length > 0) {
      issues.push({
        message: clarificationQuestion ??
          `Une précision est nécessaire pour la ligne ${index + 1}.`,
        blocking: true,
        code: "clarification_required",
        item_key: itemKey,
      });
    }

    const confidence = surfaceMismatch || suggestionSurfaceMismatch
      ? "low"
      : isConfidence(source.confidence)
      ? source.confidence
      : "low";
    const applicable = Boolean(
      service && quantity !== null && ambiguities.length === 0,
    );
    const unitPrice = service
      ? Number(service.default_unit_price_ht || 0)
      : null;
    const description = service
      ? buildDescription(service, requestedCoats)
      : catalogSuggestion.description;

    return {
      key: itemKey,
      room_key: roomKey,
      service_catalog_id: service?.id ?? null,
      label: service?.name ?? catalogSuggestion.name,
      description,
      unit: service?.default_unit ?? catalogSuggestion.unit,
      quantity,
      unit_price_ht: unitPrice,
      tva_rate: service ? Number(service.default_tva_rate || 0) : null,
      requested_coats: requestedCoats,
      surface_type: surfaceType,
      surface_explicit: surfaceType !== null,
      ambiguities,
      clarification_question: clarificationQuestion,
      confidence,
      source_excerpt: cleanText(source.source_excerpt, 300),
      applicable,
      total_ht: applicable && quantity !== null && unitPrice !== null
        ? roundMoney(quantity * unitPrice)
        : null,
      catalog_suggestion: catalogSuggestion,
    };
  });

  const questions = Array.isArray(modelDraft.questions)
    ? modelDraft.questions
      .map((question) => cleanText(question, 300))
      .filter(Boolean)
    : [];

  for (const question of questions) {
    if (
      !issues.some((issue) =>
        normalizeSearchText(issue.message) === normalizeSearchText(question)
      )
    ) {
      issues.push({
        message: question,
        blocking: true,
        code: "clarification_required",
      });
    }
  }

  if (resolvedItems.length === 0) {
    issues.push({
      message: "Aucune ligne de devis n'a été reconnue.",
      blocking: true,
    });
  }

  return {
    draft_id: crypto.randomUUID(),
    quote_id: quoteId,
    transcript,
    summary: cleanText(modelDraft.summary, 500) ||
      "Brouillon préparé depuis la description des travaux.",
    rooms: resolvedRooms,
    items: resolvedItems,
    issues,
    can_apply: resolvedItems.some((item) => item.applicable),
  };
}
