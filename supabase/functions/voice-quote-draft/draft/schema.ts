import {
  AMBIGUITY_CODES,
  CATALOG_UNITS,
  PRICING_BASES,
  SURFACE_TYPES,
} from "../shared/constants.ts";
import type { CatalogService, ExistingRoom } from "../shared/types.ts";

/**
 * Schéma de sortie structurée. Les identifiants de pièce et de prestation
 * sont des `enum` remplis avec les valeurs réelles : le modèle ne peut donc
 * pas référencer une prestation qui n'appartient pas à l'entreprise.
 *
 * Les catégories viennent des métiers actifs de l'entreprise, plus jamais
 * d'une liste codée en dur.
 */
export function createDraftSchema(
  rooms: ExistingRoom[],
  services: CatalogService[],
  categories: string[],
) {
  const nullableExistingRoomId = rooms.length > 0
    ? {
      anyOf: [
        { type: "string", enum: rooms.map((room) => room.id) },
        { type: "null" },
      ],
    }
    : { type: "null" };

  const nullableServiceId = {
    anyOf: [
      { type: "string", enum: services.map((service) => service.id) },
      { type: "null" },
    ],
  };

  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      rooms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            key: { type: "string" },
            action: { type: "string", enum: ["create", "reuse"] },
            existing_room_id: nullableExistingRoomId,
            name: { type: "string" },
            notes: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
          required: [
            "key",
            "action",
            "existing_room_id",
            "name",
            "notes",
          ],
          additionalProperties: false,
        },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            room_key: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            catalog_service_id: nullableServiceId,
            catalog_suggestion: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                },
                category: {
                  type: "string",
                  enum: categories,
                },
                unit: {
                  type: "string",
                  enum: [...CATALOG_UNITS],
                },
                pricing_basis: {
                  type: "string",
                  enum: [...PRICING_BASES],
                },
              },
              required: [
                "name",
                "description",
                "category",
                "unit",
                "pricing_basis",
              ],
              additionalProperties: false,
            },
            quantity: {
              anyOf: [{ type: "number" }, { type: "null" }],
            },
            requested_coats: {
              anyOf: [{ type: "integer" }, { type: "null" }],
            },
            surface_type: {
              anyOf: [
                { type: "string", enum: [...SURFACE_TYPES] },
                { type: "null" },
              ],
            },
            surface_source_excerpt: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            ambiguities: {
              type: "array",
              items: {
                type: "string",
                enum: [...AMBIGUITY_CODES],
              },
            },
            clarification_question: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            source_excerpt: { type: "string" },
          },
          required: [
            "room_key",
            "catalog_service_id",
            "catalog_suggestion",
            "quantity",
            "requested_coats",
            "surface_type",
            "surface_source_excerpt",
            "ambiguities",
            "clarification_question",
            "confidence",
            "source_excerpt",
          ],
          additionalProperties: false,
        },
      },
      questions: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["summary", "rooms", "items", "questions"],
    additionalProperties: false,
  };
}
