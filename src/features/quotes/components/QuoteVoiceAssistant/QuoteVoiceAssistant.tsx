import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../../../components/ui/Button/Button";
import { Card } from "../../../../components/ui/Card/Card";
import { ErrorMessage } from "../../../../components/ui/ErrorMessage/ErrorMessage";
import { FormField } from "../../../../components/ui/FormField/FormField";
import {
  MicrophoneIcon,
  SparklesIcon,
  StopIcon,
} from "../../../../components/ui/Icons/AppIcons";
import { TextArea } from "../../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../../components/ui/TextInput/TextInput";
import { Select } from "../../../../components/ui/Select/Select";
import {
  getCategoryLabel,
  getUnitLabel,
  PAINT_CATEGORIES,
  PAINT_UNITS,
} from "../../../catalog/catalogOptions";
import type { ServiceCatalogPricingBasis } from "../../../catalog/types";
import { supabase } from "../../../../lib/supabase";
import type { QuoteStatus } from "../../types";
import type {
  ApplyQuoteVoiceDraftResult,
  QuoteVoiceDraft,
  QuoteVoiceDraftItem,
  QuoteVoiceSurfaceType,
} from "../../voice/types";
import "./QuoteVoiceAssistant.css";

type QuoteVoiceAssistantProps = {
  quoteId: string;
  quoteStatus: QuoteStatus;
  defaultTvaRate: number;
  onApplied: () => Promise<unknown> | unknown;
};

type CatalogCreationForm = {
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_price_ht: string;
  tva_rate: string;
  pricing_basis: ServiceCatalogPricingBasis;
};

type AssistantStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "analyzing"
  | "applying";
type RecordingPurpose = "initial" | "clarification";

const MAX_RECORDING_MS = 90_000;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function parseLocalizedNumber(value: string) {
  const normalizedValue = value.trim().replace(/\s/g, "").replace(",", ".");
  return Number(normalizedValue);
}

function getConfidenceLabel(confidence: QuoteVoiceDraftItem["confidence"]) {
  if (confidence === "high") return "Confiance élevée";
  if (confidence === "medium") return "À vérifier";
  return "Confiance faible";
}

function getSurfaceLabel(surfaceType: QuoteVoiceSurfaceType | null) {
  switch (surfaceType) {
    case "wall":
      return "Murs";
    case "ceiling":
      return "Plafond";
    case "facade":
      return "Façade";
    case "woodwork":
      return "Boiseries";
    case "metal":
      return "Support métallique";
    case "floor":
      return "Sol";
    case "other":
      return "Autre support";
    default:
      return "Support non précisé";
  }
}

function getPreferredMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

async function getFunctionErrorMessage(error: unknown) {
  if (typeof error === "object" && error) {
    const context = (error as { context?: Response }).context;

    if (context) {
      try {
        const payload = (await context.clone().json()) as { error?: unknown };
        if (typeof payload.error === "string") return payload.error;
      } catch {
        // Le message générique Supabase reste disponible ci-dessous.
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Impossible d’analyser la dictée pour le moment.";
}

function isQuoteVoiceDraft(value: unknown): value is QuoteVoiceDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<QuoteVoiceDraft>;

  return (
    typeof draft.draft_id === "string" &&
    typeof draft.transcript === "string" &&
    Array.isArray(draft.rooms) &&
    Array.isArray(draft.items) &&
    Array.isArray(draft.issues)
  );
}

function createCatalogForm(
  item: QuoteVoiceDraftItem,
  defaultTvaRate: number
): CatalogCreationForm {
  const suggestion = item.catalog_suggestion ?? {
    name: item.label || "Nouvelle prestation",
    description: item.description,
    category: "other",
    unit: item.unit || "m2",
    pricing_basis: "finished_surface" as const,
  };

  return {
    name: suggestion.name || item.label,
    description: suggestion.description ?? "",
    category: suggestion.category || "other",
    unit: suggestion.unit || item.unit || "m2",
    unit_price_ht: "",
    tva_rate: String(defaultTvaRate),
    pricing_basis: suggestion.pricing_basis || "finished_surface",
  };
}

export function QuoteVoiceAssistant({
  quoteId,
  quoteStatus,
  defaultTvaRate,
  onApplied,
}: QuoteVoiceAssistantProps) {
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [clarificationText, setClarificationText] = useState("");
  const [draft, setDraft] = useState<QuoteVoiceDraft | null>(null);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(
    new Set()
  );
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [catalogForms, setCatalogForms] = useState<
    Record<string, CatalogCreationForm>
  >({});
  const [catalogErrors, setCatalogErrors] = useState<Record<string, string>>(
    {}
  );
  const [openCatalogFormItemKey, setOpenCatalogFormItemKey] = useState<
    string | null
  >(null);
  const [creatingCatalogItemKey, setCreatingCatalogItemKey] = useState<
    string | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingPurposeRef = useRef<RecordingPurpose>("initial");

  const quoteCanChange = quoteStatus === "draft" || quoteStatus === "sent";
  const isBusy =
    status === "transcribing" ||
    status === "analyzing" ||
    status === "applying";
  const isRecording = status === "recording";

  function releaseRecordingResources() {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  }

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      recorder?.stream.getTracks().forEach((track) => track.stop());

      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  async function requestDraft(
    body:
      | { transcript: string; contextTranscript?: string }
      | FormData,
    options?: { preserveDraft?: boolean }
  ) {
    setError(null);
    setSuccess(null);
    if (!options?.preserveDraft) setDraft(null);
    setCatalogErrors({});

    const { data, error: functionError } = await supabase.functions.invoke(
      "voice-quote-draft",
      {
        body:
          body instanceof FormData
            ? body
            : {
                quoteId,
                transcript: body.transcript,
                contextTranscript: body.contextTranscript,
              },
      }
    );

    if (functionError) {
      setError(await getFunctionErrorMessage(functionError));
      setStatus("idle");
      return;
    }

    if (!isQuoteVoiceDraft(data)) {
      setError("Le brouillon reçu est incomplet. Réessayez avec une phrase plus précise.");
      setStatus("idle");
      return;
    }

    const nextQuantities = Object.fromEntries(
      data.items.map((item) => [item.key, String(item.quantity ?? "")])
    );
    const nextSelection = new Set(
      data.items
        .filter(
          (item) => item.applicable && item.confidence === "high"
        )
        .map((item) => item.key)
    );
    const nextCatalogForms = Object.fromEntries(
      data.items
        .filter((item) => !item.service_catalog_id)
        .map((item) => [
          item.key,
          createCatalogForm(item, defaultTvaRate),
        ])
    );

    setTranscript(data.transcript);
    setDraft(data);
    setQuantities(nextQuantities);
    setSelectedItemKeys(nextSelection);
    setCatalogForms(nextCatalogForms);
    setOpenCatalogFormItemKey(null);
    setClarificationText("");
    setStatus("idle");
  }

  async function handleAnalyzeText() {
    const normalizedTranscript = transcript.trim();

    if (!normalizedTranscript) {
      setError("Décrivez les travaux à chiffrer ou utilisez le micro.");
      return;
    }

    setStatus("analyzing");
    await requestDraft({ transcript: normalizedTranscript });
  }

  async function handleClarifyDraft() {
    const clarification = clarificationText.trim();
    if (!draft || !clarification) {
      setError("Ajoutez une précision avant de mettre à jour le brouillon.");
      return;
    }

    setStatus("analyzing");
    await requestDraft(
      {
        transcript: clarification,
        contextTranscript: draft.transcript,
      },
      { preserveDraft: true }
    );
  }

  async function startRecording(purpose: RecordingPurpose = "initial") {
    if (purpose === "initial") setExpanded(true);
    setError(null);
    setSuccess(null);
    recordingPurposeRef.current = purpose;

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("L’enregistrement audio n’est pas pris en charge par ce navigateur.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        releaseRecordingResources();
        setStatus("idle");
        setError("L’enregistrement a été interrompu. Vous pouvez réessayer.");
      };

      recorder.onstop = () => {
        const recordingPurpose = recordingPurposeRef.current;
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const extension = audioBlob.type.includes("mp4") ? "mp4" : "webm";
        const audioFile = new File(
          [audioBlob],
          `dictee-devis.${extension}`,
          { type: audioBlob.type }
        );

        releaseRecordingResources();

        if (audioFile.size === 0) {
          setStatus("idle");
          setError("Aucun son n’a été enregistré.");
          return;
        }

        const formData = new FormData();
        formData.append("quoteId", quoteId);
        formData.append("audio", audioFile);
        if (recordingPurpose === "clarification" && draft) {
          formData.append("contextTranscript", draft.transcript);
        }
        setStatus("transcribing");
        void requestDraft(formData, {
          preserveDraft: recordingPurpose === "clarification",
        });
      };

      recorder.start();
      setStatus("recording");
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, MAX_RECORDING_MS);
    } catch (recordingError) {
      releaseRecordingResources();
      setStatus("idle");
      setError(
        recordingError instanceof DOMException &&
          recordingError.name === "NotAllowedError"
          ? "Autorisez l’accès au micro pour utiliser la dictée."
          : "Impossible de démarrer le micro."
      );
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      setStatus("transcribing");
      recorder.stop();
    }
  }

  function toggleItem(itemKey: string) {
    setSelectedItemKeys((current) => {
      const next = new Set(current);
      if (next.has(itemKey)) next.delete(itemKey);
      else next.add(itemKey);
      return next;
    });
  }

  function resetDraft() {
    setDraft(null);
    setSelectedItemKeys(new Set());
    setQuantities({});
    setCatalogForms({});
    setCatalogErrors({});
    setClarificationText("");
    setOpenCatalogFormItemKey(null);
    setError(null);
  }

  function updateCatalogFormField<K extends keyof CatalogCreationForm>(
    itemKey: string,
    field: K,
    value: CatalogCreationForm[K]
  ) {
    setCatalogErrors((current) => {
      if (!current[itemKey]) return current;
      const next = { ...current };
      delete next[itemKey];
      return next;
    });
    setCatalogForms((current) => ({
      ...current,
      [itemKey]: {
        ...current[itemKey],
        [field]: value,
      },
    }));
  }

  function showCatalogError(itemKey: string, message: string) {
    setCatalogErrors((current) => ({
      ...current,
      [itemKey]: message,
    }));
  }

  function updateItemQuantity(item: QuoteVoiceDraftItem, value: string) {
    setQuantities((current) => ({
      ...current,
      [item.key]: value,
    }));

    if (!item.service_catalog_id) return;

    const quantity = Number(value);
    const hasClarification = (item.ambiguities?.length ?? 0) > 0;
    const isValid =
      Number.isFinite(quantity) && quantity > 0 && !hasClarification;

    setSelectedItemKeys((current) => {
      const next = new Set(current);
      if (isValid) next.add(item.key);
      else next.delete(item.key);
      return next;
    });
    setDraft((current) => {
      if (!current) return current;

      const items = current.items.map((currentItem) =>
        currentItem.key === item.key
          ? {
              ...currentItem,
              quantity: isValid ? quantity : null,
              applicable: isValid,
              total_ht:
                isValid && currentItem.unit_price_ht !== null
                  ? quantity * currentItem.unit_price_ht
                  : null,
            }
          : currentItem
      );

      return {
        ...current,
        items,
        issues: isValid
          ? current.issues.filter(
              (issue) =>
                !(
                  issue.code === "missing_quantity" &&
                  issue.item_key === item.key
                )
            )
          : current.issues,
        can_apply: items.some((currentItem) => currentItem.applicable),
      };
    });
  }

  async function createCatalogService(
    event: FormEvent<HTMLFormElement>,
    item: QuoteVoiceDraftItem
  ) {
    event.preventDefault();
    const form = catalogForms[item.key];
    if (!form || !draft) return;
    if ((item.ambiguities?.length ?? 0) > 0) {
      showCatalogError(
        item.key,
        "Répondez d’abord aux éléments à confirmer avant de créer cette prestation."
      );
      return;
    }

    const unitPrice = parseLocalizedNumber(form.unit_price_ht);
    const tvaRate = parseLocalizedNumber(form.tva_rate);
    const baseQuantity = parseLocalizedNumber(quantities[item.key] ?? "");

    if (!form.name.trim()) {
      showCatalogError(item.key, "Le nom de la prestation est obligatoire.");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      showCatalogError(
        item.key,
        "Saisissez un prix unitaire HT supérieur à zéro."
      );
      return;
    }

    if (!Number.isFinite(tvaRate) || tvaRate < 0 || tvaRate > 100) {
      showCatalogError(
        item.key,
        "Le taux de TVA doit être compris entre 0 et 100."
      );
      return;
    }

    if (!Number.isFinite(baseQuantity) || baseQuantity <= 0) {
      showCatalogError(
        item.key,
        "Saisissez une quantité supérieure à zéro."
      );
      return;
    }

    setCreatingCatalogItemKey(item.key);
    setError(null);
    setSuccess(null);
    setCatalogErrors((current) => {
      const next = { ...current };
      delete next[item.key];
      return next;
    });

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        showCatalogError(
          item.key,
          "Votre session a expiré. Reconnectez-vous."
        );
        return;
      }

      const defaultMetadata: Record<string, unknown> = {
        pricing_basis: form.pricing_basis,
      };

      if (
        form.pricing_basis === "finished_surface" &&
        item.requested_coats
      ) {
        defaultMetadata.included_coats = item.requested_coats;
      }

      const createdService = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        category: form.category,
        default_unit: form.unit,
        default_unit_price_ht: unitPrice,
        default_tva_rate: tvaRate,
        default_description: form.description.trim() || null,
      };
      const { error: createError } = await supabase
        .from("service_catalog")
        .insert({
          ...createdService,
          owner_user_id: user.id,
          default_metadata: defaultMetadata,
          is_active: true,
        });

      if (createError) {
        showCatalogError(item.key, createError.message);
        return;
      }

      const adjustedQuantity =
        form.pricing_basis === "per_coat" &&
        item.requested_coats &&
        item.requested_coats > 1
          ? baseQuantity * item.requested_coats
          : baseQuantity;

      setQuantities((current) => ({
        ...current,
        [item.key]: String(adjustedQuantity),
      }));
      setSelectedItemKeys((current) => {
        const next = new Set(current);
        next.add(item.key);
        return next;
      });
      setDraft((current) => {
        if (!current) return current;

        const items = current.items.map((currentItem) =>
          currentItem.key === item.key
            ? {
                ...currentItem,
                service_catalog_id: createdService.id,
                label: createdService.name,
                description: createdService.default_description,
                unit: createdService.default_unit,
                quantity: adjustedQuantity,
                unit_price_ht: createdService.default_unit_price_ht,
                tva_rate: createdService.default_tva_rate,
                applicable: true,
                total_ht:
                  adjustedQuantity * createdService.default_unit_price_ht,
                catalog_suggestion: {
                  ...currentItem.catalog_suggestion,
                  name: createdService.name,
                  description: createdService.default_description,
                  category: createdService.category,
                  unit: createdService.default_unit,
                  pricing_basis: form.pricing_basis,
                },
              }
            : currentItem
        );

        return {
          ...current,
          items,
          issues: current.issues.filter(
            (issue) =>
              !(
                issue.code === "missing_catalog_service" &&
                issue.item_key === item.key
              )
          ),
          can_apply: items.some((currentItem) => currentItem.applicable),
        };
      });

      setOpenCatalogFormItemKey(null);
      setSuccess(
        `« ${createdService.name} » a été ajouté au catalogue et sélectionné.`
      );
    } catch {
      showCatalogError(
        item.key,
        "Une erreur inattendue a empêché l’ajout au catalogue."
      );
    } finally {
      setCreatingCatalogItemKey(null);
    }
  }

  async function applyDraft() {
    if (!draft) return;

    const selectedItems = draft.items.filter(
      (item) => item.applicable && selectedItemKeys.has(item.key)
    );

    if (selectedItems.length === 0) {
      setError("Sélectionnez au moins une ligne à ajouter au devis.");
      return;
    }

    const itemsPayload = selectedItems.map((item) => ({
      room_key: item.room_key,
      service_catalog_id: item.service_catalog_id,
      quantity: Number(quantities[item.key]),
      requested_coats: item.requested_coats,
      source_excerpt: item.source_excerpt,
    }));

    if (
      itemsPayload.some(
        (item) => !Number.isFinite(item.quantity) || item.quantity <= 0
      )
    ) {
      setError("Chaque ligne sélectionnée doit avoir une quantité supérieure à zéro.");
      return;
    }

    const usedRoomKeys = new Set(
      selectedItems
        .map((item) => item.room_key)
        .filter((roomKey): roomKey is string => Boolean(roomKey))
    );
    const roomsPayload = draft.rooms
      .filter((room) => usedRoomKeys.has(room.key))
      .map((room) => ({
        key: room.key,
        action: room.action,
        existing_room_id: room.existing_room_id,
        name: room.name,
        notes: room.notes,
      }));

    setStatus("applying");
    setError(null);
    setSuccess(null);

    const { data, error: rpcError } = await supabase.rpc(
      "apply_quote_voice_draft",
      {
        p_quote_id: quoteId,
        p_draft_id: draft.draft_id,
        p_rooms: roomsPayload,
        p_items: itemsPayload,
      }
    );

    if (rpcError) {
      setError(rpcError.message);
      setStatus("idle");
      return;
    }

    const result = data as ApplyQuoteVoiceDraftResult | null;
    const addedCount = result?.item_ids?.length ?? selectedItems.length;

    setDraft(null);
    setSelectedItemKeys(new Set());
    setQuantities({});
    setClarificationText("");
    setStatus("idle");
    setSuccess(
      result?.already_applied
        ? "Ce brouillon avait déjà été ajouté au devis."
        : `${addedCount} ligne${addedCount > 1 ? "s" : ""} ajoutée${
            addedCount > 1 ? "s" : ""
          } au devis.`
    );

    try {
      await onApplied();
    } catch {
      setError(
        "Les lignes ont été ajoutées, mais l’écran n’a pas pu être actualisé. Rechargez la page."
      );
    }
  }

  const selectedTotal = useMemo(() => {
    if (!draft) return 0;

    return draft.items.reduce((total, item) => {
      if (!item.applicable || !selectedItemKeys.has(item.key)) return total;
      const quantity = Number(quantities[item.key]);
      if (!Number.isFinite(quantity) || !item.unit_price_ht) return total;
      return total + quantity * item.unit_price_ht;
    }, 0);
  }, [draft, quantities, selectedItemKeys]);

  const roomNames = useMemo(
    () =>
      new Map((draft?.rooms ?? []).map((room) => [room.key, room.name])),
    [draft]
  );
  const hasClarificationIssues =
    draft?.issues.some(
      (issue) => issue.code === "clarification_required"
    ) ?? false;

  return (
    <Card className="quote-voice-assistant">
      <div className="quote-voice-assistant__header">
        <div className="quote-voice-assistant__title-wrap">
          <span className="quote-voice-assistant__icon">
            <SparklesIcon />
          </span>
          <div>
            <div className="quote-voice-assistant__eyebrow">Assistant de devis</div>
            <h2>Dicter les travaux</h2>
            <p>
              L’assistant prépare un brouillon depuis votre catalogue. Rien
              n’est ajouté sans votre confirmation.
            </p>
          </div>
        </div>

        <div className="quote-voice-assistant__header-actions">
          {isRecording ? (
            <Button
              type="button"
              variant="danger"
              onClick={stopRecording}
              aria-label="Arrêter l’enregistrement"
            >
              <StopIcon />
              Arrêter
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => void startRecording()}
              disabled={!quoteCanChange || isBusy}
              aria-label="Commencer la dictée"
            >
              <MicrophoneIcon />
              Dicter
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setExpanded((current) => !current)}
            disabled={isRecording}
          >
            {expanded ? "Réduire" : "Saisir du texte"}
          </Button>
        </div>
      </div>

      {!quoteCanChange ? (
        <p className="quote-voice-assistant__notice">
          Ce devis n’est plus modifiable. La dictée reste disponible sur les
          devis brouillons ou envoyés.
        </p>
      ) : null}

      {isRecording ? (
        <div className="quote-voice-assistant__recording" role="status">
          <span className="quote-voice-assistant__recording-dot" />
          {recordingPurposeRef.current === "clarification"
            ? "Précision en cours… corrigez uniquement les éléments à confirmer, puis arrêtez le micro."
            : "Enregistrement en cours… parlez naturellement, puis arrêtez le micro."}
        </div>
      ) : null}

      {expanded ? (
        <div className="quote-voice-assistant__input">
          <label htmlFor="quote-voice-transcript">
            Travaux à ajouter au devis
          </label>
          <TextArea
            id="quote-voice-transcript"
            rows={4}
            maxLength={8_000}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Ex. La façade fait 45 m². Je souhaite une couche de primaire et deux couches de finition."
            disabled={!quoteCanChange || isBusy || isRecording}
          />
          <div className="quote-voice-assistant__input-footer">
            <span>{transcript.length}/8 000 caractères</span>
            <Button
              type="button"
              onClick={() => void handleAnalyzeText()}
              disabled={!quoteCanChange || isBusy || isRecording}
            >
              <SparklesIcon />
              {status === "analyzing" ? "Analyse…" : "Préparer le brouillon"}
            </Button>
          </div>
        </div>
      ) : null}

      {status === "transcribing" ? (
        <p className="quote-voice-assistant__progress" role="status">
          Transcription et rapprochement avec le catalogue…
        </p>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}
      {success ? (
        <p className="quote-voice-assistant__success" role="status">
          {success}
        </p>
      ) : null}

      {draft ? (
        <div className="quote-voice-assistant__draft">
          <div className="quote-voice-assistant__draft-intro">
            <div>
              <span>Brouillon à confirmer</span>
              <h3>{draft.summary}</h3>
            </div>
            <strong>{formatCurrency(selectedTotal)} HT</strong>
          </div>

          {draft.rooms.length > 0 ? (
            <div className="quote-voice-assistant__rooms">
              {draft.rooms.map((room) => (
                <span key={room.key}>
                  {room.action === "create" ? "Nouvelle pièce" : "Pièce existante"}
                  {" · "}
                  <strong>{room.name}</strong>
                </span>
              ))}
            </div>
          ) : null}

          {draft.issues.length > 0 ? (
            <ul className="quote-voice-assistant__issues">
              {draft.issues.map((issue, index) => (
                <li
                  key={`${issue.message}-${index}`}
                  className={
                    issue.blocking
                      ? "quote-voice-assistant__issue--blocking"
                      : undefined
                  }
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}

          {hasClarificationIssues ? (
            <section className="quote-voice-assistant__clarification">
              <div className="quote-voice-assistant__clarification-intro">
                <strong>Apporter une précision</strong>
                <span>
                  Répondez aux éléments à confirmer. Le brouillon sera recalculé
                  sans ajouter de ligne au devis.
                </span>
              </div>

              <TextArea
                rows={3}
                maxLength={2_000}
                value={clarificationText}
                onChange={(event) => setClarificationText(event.target.value)}
                placeholder="Ex. Les 45 m² de la cuisine concernent les murs. Les 30 m² sont pour la salle de bain. Pour le grenier, comptez 3 couches au total."
                disabled={isBusy || isRecording}
              />

              <div className="quote-voice-assistant__clarification-actions">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleClarifyDraft()}
                  disabled={
                    isBusy || isRecording || !clarificationText.trim()
                  }
                >
                  <SparklesIcon />
                  Mettre à jour le brouillon
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void startRecording("clarification")}
                  disabled={isBusy || isRecording}
                >
                  <MicrophoneIcon />
                  Préciser au micro
                </Button>
              </div>
            </section>
          ) : null}

          <div className="quote-voice-assistant__items">
            {draft.items.map((item) => {
              const selected =
                item.applicable && selectedItemKeys.has(item.key);
              const needsClarification =
                (item.ambiguities?.length ?? 0) > 0;
              const catalogForm = catalogForms[item.key];
              const showCatalogForm =
                openCatalogFormItemKey === item.key && Boolean(catalogForm);
              const itemQuantity = Number(quantities[item.key]);
              const itemTotal =
                Number.isFinite(itemQuantity) && item.unit_price_ht
                  ? itemQuantity * item.unit_price_ht
                  : 0;

              return (
                <article
                  key={item.key}
                  className={`quote-voice-assistant__item ${
                    selected ? "quote-voice-assistant__item--selected" : ""
                  }`}
                >
                  <label className="quote-voice-assistant__item-select">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!item.applicable}
                      onChange={() => toggleItem(item.key)}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      <small>
                        {item.room_key
                          ? roomNames.get(item.room_key) ?? "Pièce"
                          : "Sans pièce"}
                        {" · "}
                        {getConfidenceLabel(item.confidence)}
                        {" · "}
                        {getSurfaceLabel(item.surface_type ?? null)}
                      </small>
                    </span>
                  </label>

                  <div className="quote-voice-assistant__item-pricing">
                    <label>
                      Quantité ({getUnitLabel(item.unit)})
                      <TextInput
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={quantities[item.key] ?? ""}
                        disabled={creatingCatalogItemKey === item.key}
                        onChange={(event) =>
                          updateItemQuantity(item, event.target.value)
                        }
                      />
                    </label>
                    <span>
                      {item.unit_price_ht === null
                        ? "Prix catalogue introuvable"
                        : `${formatCurrency(item.unit_price_ht)} / ${getUnitLabel(
                            item.unit
                          )}`}
                    </span>
                    <strong>{formatCurrency(itemTotal)} HT</strong>
                  </div>

                  {needsClarification ? (
                    <div className="quote-voice-assistant__item-warning">
                      <p>
                        {item.clarification_question ??
                          "Une précision est nécessaire avant de pouvoir sélectionner cette ligne."}
                      </p>
                    </div>
                  ) : null}

                  {!item.applicable &&
                  !item.service_catalog_id &&
                  !needsClarification ? (
                    <div className="quote-voice-assistant__item-warning">
                      <p>
                        Cette prestation n’existe pas encore dans le catalogue.
                        Ajoutez-la avec son prix pour pouvoir intégrer la ligne
                        au devis.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setOpenCatalogFormItemKey((current) =>
                            current === item.key ? null : item.key
                          )
                        }
                      >
                        {showCatalogForm
                          ? "Masquer"
                          : "Ajouter au catalogue avec un prix"}
                      </Button>
                    </div>
                  ) : null}

                  {!item.applicable &&
                  item.service_catalog_id &&
                  !needsClarification ? (
                    <div className="quote-voice-assistant__item-warning">
                      <p>
                        Indiquez une quantité supérieure à zéro pour pouvoir
                        sélectionner cette ligne.
                      </p>
                    </div>
                  ) : null}

                  {showCatalogForm && catalogForm ? (
                    <form
                      className="quote-voice-assistant__catalog-form"
                      noValidate
                      onSubmit={(event) =>
                        void createCatalogService(event, item)
                      }
                    >
                      <div className="quote-voice-assistant__catalog-form-intro">
                        <strong>Nouvelle prestation du catalogue</strong>
                        <span>
                          La pièce «{" "}
                          {item.room_key
                            ? roomNames.get(item.room_key) ?? "Sans nom"
                            : "Sans pièce"}{" "}
                          » restera séparée de ce nom.
                        </span>
                      </div>

                      <div className="quote-voice-assistant__catalog-form-grid">
                        <FormField label="Nom réutilisable">
                          <TextInput
                            value={catalogForm.name}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "name",
                                event.target.value
                              )
                            }
                            placeholder="Application de peinture blanche - 1 couche"
                          />
                        </FormField>

                        <FormField label={`Prix HT / ${getUnitLabel(catalogForm.unit)}`}>
                          <TextInput
                            type="text"
                            inputMode="decimal"
                            autoFocus
                            value={catalogForm.unit_price_ht}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "unit_price_ht",
                                event.target.value
                              )
                            }
                            placeholder="12.50"
                          />
                        </FormField>

                        <FormField label="Unité">
                          <Select
                            value={catalogForm.unit}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "unit",
                                event.target.value
                              )
                            }
                          >
                            {PAINT_UNITS.map((unit) => (
                              <option key={unit} value={unit}>
                                {getUnitLabel(unit)}
                              </option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="TVA (%)">
                          <TextInput
                            type="text"
                            inputMode="decimal"
                            value={catalogForm.tva_rate}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "tva_rate",
                                event.target.value
                              )
                            }
                          />
                        </FormField>

                        <FormField label="Catégorie">
                          <Select
                            value={catalogForm.category}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "category",
                                event.target.value
                              )
                            }
                          >
                            {PAINT_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {getCategoryLabel(category)}
                              </option>
                            ))}
                          </Select>
                        </FormField>

                        <FormField label="Mode de calcul">
                          <Select
                            value={catalogForm.pricing_basis}
                            onChange={(event) =>
                              updateCatalogFormField(
                                item.key,
                                "pricing_basis",
                                event.target
                                  .value as ServiceCatalogPricingBasis
                              )
                            }
                          >
                            <option value="finished_surface">
                              Surface finie
                            </option>
                            <option value="per_coat">
                              Surface × nombre de couches
                            </option>
                            <option value="per_unit">À l’unité</option>
                          </Select>
                        </FormField>
                      </div>

                      <FormField label="Description">
                        <TextArea
                          rows={2}
                          value={catalogForm.description}
                          onChange={(event) =>
                            updateCatalogFormField(
                              item.key,
                              "description",
                              event.target.value
                            )
                          }
                        />
                      </FormField>

                      <div className="quote-voice-assistant__catalog-form-actions">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={creatingCatalogItemKey === item.key}
                        >
                          {creatingCatalogItemKey === item.key
                            ? "Ajout au catalogue…"
                            : "Créer et sélectionner"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={creatingCatalogItemKey === item.key}
                          onClick={() => setOpenCatalogFormItemKey(null)}
                        >
                          Annuler
                        </Button>
                      </div>

                      {catalogErrors[item.key] ? (
                        <ErrorMessage message={catalogErrors[item.key]} />
                      ) : null}
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="quote-voice-assistant__draft-actions">
            <Button
              type="button"
              onClick={() => void applyDraft()}
              disabled={!draft.can_apply || status === "applying"}
            >
              {status === "applying"
                ? "Ajout en cours…"
                : "Ajouter les lignes sélectionnées"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={resetDraft}
              disabled={status === "applying"}
            >
              Annuler le brouillon
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
