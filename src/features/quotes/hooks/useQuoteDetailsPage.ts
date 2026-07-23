import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import type { ServiceCatalogItem } from "../../catalog/types";
import { generateQuotePdf } from "../pdf/generateQuotePdf";
import type {
  QuoteItemInlineEdit,
  QuotePdfData,
  QuoteRoomPageBreak,
} from "../pdf/quotePdfTypes";
import type {
  Company,
  Customer,
  CustomerOption,
  QuoteDetails,
  QuoteGeneralFormState,
  QuoteItem,
  QuoteItemFormState,
  Room,
  RoomFormState,
  RoomPhoto,
  RoomPhotoWithUrl,
  RoomTemplate,
} from "../types";
import {
  createInitialItemForm,
  createInitialQuoteGeneralForm,
  createInitialRoomForm,
  getDefaultValidUntil,
  getNextSortOrder,
  mapItemToForm,
} from "../utils/quoteDetailsForm";

const ROOM_PHOTOS_BUCKET = "quote-room-photos";
const MAX_ROOM_PHOTO_SIZE = 10 * 1024 * 1024;
const ROOM_PHOTO_MIME_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

async function fetchRoomPhotos(roomIds: string[]) {
  if (roomIds.length === 0) {
    return { photos: [] as RoomPhoto[], error: null as string | null };
  }

  const { data, error } = await supabase
    .from("quote_room_photos")
    .select(
      "id, room_id, uploaded_by, storage_path, original_name, mime_type, size_bytes, caption, sort_order, created_at",
    )
    .in("room_id", roomIds)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return {
    photos: (data ?? []) as RoomPhoto[],
    error: error?.message ?? null,
  };
}

export function useQuoteDetailsPage() {
  const { quoteId } = useParams();

  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTemplates, setRoomTemplates] = useState<RoomTemplate[]>([]);
  const [roomPhotos, setRoomPhotos] = useState<RoomPhoto[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [duplicatingRoomId, setDuplicatingRoomId] = useState<string | null>(null);
  const [savingRoomTemplateId, setSavingRoomTemplateId] = useState<string | null>(null);
  const [insertingRoomTemplateId, setInsertingRoomTemplateId] = useState<string | null>(null);
  const [uploadingPhotoRoomId, setUploadingPhotoRoomId] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [addingCatalogServiceId, setAddingCatalogServiceId] = useState<string | null>(null);
  const [movingItem, setMovingItem] = useState<QuoteItem | null>(null);
  const [moveRoomId, setMoveRoomId] = useState("");
  const [movingItemLoading, setMovingItemLoading] = useState(false);
  const [savingPdfFontSize, setSavingPdfFontSize] = useState(false);
  const [savingQuoteOrder, setSavingQuoteOrder] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [showRoomForm, setShowRoomForm] = useState(false);
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [catalogRoomId, setCatalogRoomId] = useState("");

  const [quoteGeneralForm, setQuoteGeneralForm] = useState<QuoteGeneralFormState>(
    createInitialQuoteGeneralForm(null)
  );
  const [itemForm, setItemForm] = useState<QuoteItemFormState>(
    createInitialItemForm()
  );
  const [roomForm, setRoomForm] = useState<RoomFormState>(
    createInitialRoomForm()
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchQuotePage() {
      if (!quoteId) {
        if (!cancelled) {
          setError("Devis introuvable.");
          setLoading(false);
        }
        return;
      }

      const quoteRes = await supabase
        .from("quotes")
        .select(
          "id, quote_number, title, description, status, issue_date, valid_until, tva_rate, notes, terms, subtotal_ht, total_tva, total_ttc, customer_id, company_id, pdf_font_size_adjustment, pdf_other_section_position"
        )
        .eq("id", quoteId)
        .single();

      if (quoteRes.error) {
        setError(quoteRes.error.message);
        setLoading(false);
        return;
      }

      const loadedQuote = quoteRes.data as QuoteDetails;

      const [
        itemsRes, roomsRes, roomTemplatesRes, servicesRes, customerOptionsRes,
        companyCoreRes, companySettingsRes, companyAddrRes,
        customerCoreRes, customerAddrsRes,
      ] = await Promise.all([
        supabase
          .from("quote_items")
          .select("id, quote_id, room_id, item_type, category, label, description, unit, quantity, unit_price_ht, tva_rate, sort_order")
          .eq("quote_id", quoteId)
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("quote_rooms")
          .select("id, name, notes, sort_order, pdf_page_break")
          .eq("quote_id", quoteId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("quote_room_templates")
          .select("id, company_id, name, room_name, created_at")
          .eq("company_id", loadedQuote.company_id)
          .order("name", { ascending: true }),
        supabase
          .from("service_catalog")
          .select("id, name, category, default_unit, default_unit_price_ht, default_tva_rate, default_description, default_metadata, is_active")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true }),
        supabase
          .from("customers")
          .select("id, company_name, first_name, last_name")
          .is("archived_at", null),
        supabase
          .from("companies")
          .select("id, name, vat_number, email, phone, website, iban, bic, logo_url, accent_color")
          .eq("id", loadedQuote.company_id)
          .single(),
        supabase
          .from("company_settings")
          .select("default_tva_rate, default_quote_validity_days, default_notes, default_terms, pdf_theme, pdf_color_mode, pdf_accent_color")
          .eq("company_id", loadedQuote.company_id)
          .maybeSingle(),
        supabase
          .from("addresses")
          .select("line1, line2, postal_code, city, country")
          .eq("entity_id", loadedQuote.company_id)
          .eq("entity_type", "company")
          .eq("role", "main")
          .maybeSingle(),
        supabase
          .from("customers")
          .select("id, company_name, first_name, last_name, email, phone")
          .eq("id", loadedQuote.customer_id)
          .single(),
        supabase
          .from("addresses")
          .select("role, line1, line2, postal_code, city, country")
          .eq("entity_id", loadedQuote.customer_id)
          .eq("entity_type", "customer"),
      ]);

      if (cancelled) return;

      if (itemsRes.error) { setError(itemsRes.error.message); setLoading(false); return; }
      if (roomsRes.error) { setError(roomsRes.error.message); setLoading(false); return; }
      if (roomTemplatesRes.error) { setError(roomTemplatesRes.error.message); setLoading(false); return; }
      if (servicesRes.error) { setError(servicesRes.error.message); setLoading(false); return; }
      if (customerOptionsRes.error) { setError(customerOptionsRes.error.message); setLoading(false); return; }
      if (companyCoreRes.error) { setError(companyCoreRes.error.message); setLoading(false); return; }
      if (customerCoreRes.error) { setError(customerCoreRes.error.message); setLoading(false); return; }

      const loadedRooms = (roomsRes.data ?? []) as Room[];
      const photosResult = await fetchRoomPhotos(loadedRooms.map((room) => room.id));

      if (cancelled) return;
      if (photosResult.error) {
        setError(photosResult.error);
        setLoading(false);
        return;
      }

      const companyAddr = companyAddrRes.data;
      const mergedCompany: Company = {
        ...companyCoreRes.data,
        ...(companySettingsRes.data ?? {}),
        address_line1: companyAddr?.line1 ?? null,
        address_line2: companyAddr?.line2 ?? null,
        postal_code: companyAddr?.postal_code ?? null,
        city: companyAddr?.city ?? null,
        country: companyAddr?.country ?? null,
      } as Company;

      const customerAddrs = customerAddrsRes.data ?? [];
      const billingAddr = customerAddrs.find((a) => a.role === "billing");
      const jobsiteAddr = customerAddrs.find((a) => a.role === "jobsite");
      const mergedCustomer: Customer = {
        ...customerCoreRes.data,
        billing_address_line1: billingAddr?.line1 ?? null,
        billing_address_line2: billingAddr?.line2 ?? null,
        billing_postal_code: billingAddr?.postal_code ?? null,
        billing_city: billingAddr?.city ?? null,
        billing_country: billingAddr?.country ?? null,
        jobsite_address_line1: jobsiteAddr?.line1 ?? null,
        jobsite_address_line2: jobsiteAddr?.line2 ?? null,
        jobsite_postal_code: jobsiteAddr?.postal_code ?? null,
        jobsite_city: jobsiteAddr?.city ?? null,
        jobsite_country: jobsiteAddr?.country ?? null,
      };

      const availableCustomers = (customerOptionsRes.data ?? []) as CustomerOption[];
      if (!availableCustomers.some((option) => option.id === mergedCustomer.id)) {
        availableCustomers.push({
          id: mergedCustomer.id,
          company_name: mergedCustomer.company_name,
          first_name: mergedCustomer.first_name,
          last_name: mergedCustomer.last_name,
        });
      }
      availableCustomers.sort((a, b) => {
        const nameA = a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ");
        const nameB = b.company_name || [b.first_name, b.last_name].filter(Boolean).join(" ");
        return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
      });

      setQuote(loadedQuote);
      setQuoteGeneralForm(createInitialQuoteGeneralForm(loadedQuote));
      setItems((itemsRes.data ?? []) as QuoteItem[]);
      setRooms(loadedRooms);
      setRoomTemplates((roomTemplatesRes.data ?? []) as RoomTemplate[]);
      setRoomPhotos(photosResult.photos);
      setCompany(mergedCompany);
      setCustomer(mergedCustomer);
      setCustomerOptions(availableCustomers);
      setServices((servicesRes.data ?? []) as ServiceCatalogItem[]);
      setError(null);
      setLoading(false);
    }

    void fetchQuotePage();

    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  async function reloadQuoteData() {
    if (!quoteId) {
      setError("Devis introuvable.");
      return;
    }

    const quoteRes = await supabase
      .from("quotes")
      .select(
        "id, quote_number, title, description, status, issue_date, valid_until, tva_rate, notes, terms, subtotal_ht, total_tva, total_ttc, customer_id, company_id, pdf_font_size_adjustment, pdf_other_section_position"
      )
      .eq("id", quoteId)
      .single();

    if (quoteRes.error) {
      setError(quoteRes.error.message);
      return;
    }

    const loadedQuote = quoteRes.data as QuoteDetails;

    const [
      itemsRes, roomsRes, roomTemplatesRes, servicesRes,
      companyCoreRes, companySettingsRes, companyAddrRes,
      customerCoreRes, customerAddrsRes,
    ] = await Promise.all([
      supabase
        .from("quote_items")
        .select("id, quote_id, room_id, item_type, category, label, description, unit, quantity, unit_price_ht, tva_rate, sort_order")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("quote_rooms")
        .select("id, name, notes, sort_order, pdf_page_break")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_room_templates")
        .select("id, company_id, name, room_name, created_at")
        .eq("company_id", loadedQuote.company_id)
        .order("name", { ascending: true }),
      supabase
        .from("service_catalog")
        .select("id, name, category, default_unit, default_unit_price_ht, default_tva_rate, default_description, default_metadata, is_active")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("companies")
        .select("id, name, vat_number, email, phone, website, iban, bic, logo_url, accent_color")
        .eq("id", loadedQuote.company_id)
        .single(),
      supabase
        .from("company_settings")
        .select("default_tva_rate, default_quote_validity_days, default_notes, default_terms, pdf_theme, pdf_color_mode, pdf_accent_color")
        .eq("company_id", loadedQuote.company_id)
        .maybeSingle(),
      supabase
        .from("addresses")
        .select("line1, line2, postal_code, city, country")
        .eq("entity_id", loadedQuote.company_id)
        .eq("entity_type", "company")
        .eq("role", "main")
        .maybeSingle(),
      supabase
        .from("customers")
        .select("id, company_name, first_name, last_name, email, phone")
        .eq("id", loadedQuote.customer_id)
        .single(),
      supabase
        .from("addresses")
        .select("role, line1, line2, postal_code, city, country")
        .eq("entity_id", loadedQuote.customer_id)
        .eq("entity_type", "customer"),
    ]);

    if (itemsRes.error) { setError(itemsRes.error.message); return; }
    if (roomsRes.error) { setError(roomsRes.error.message); return; }
    if (roomTemplatesRes.error) { setError(roomTemplatesRes.error.message); return; }
    if (servicesRes.error) { setError(servicesRes.error.message); return; }
    if (companyCoreRes.error) { setError(companyCoreRes.error.message); return; }
    if (customerCoreRes.error) { setError(customerCoreRes.error.message); return; }

    const loadedRooms = (roomsRes.data ?? []) as Room[];
    const photosResult = await fetchRoomPhotos(loadedRooms.map((room) => room.id));
    if (photosResult.error) { setError(photosResult.error); return; }

    const companyAddr = companyAddrRes.data;
    const mergedCompany: Company = {
      ...companyCoreRes.data,
      ...(companySettingsRes.data ?? {}),
      address_line1: companyAddr?.line1 ?? null,
      address_line2: companyAddr?.line2 ?? null,
      postal_code: companyAddr?.postal_code ?? null,
      city: companyAddr?.city ?? null,
      country: companyAddr?.country ?? null,
    } as Company;

    const customerAddrs = customerAddrsRes.data ?? [];
    const billingAddr = customerAddrs.find((a) => a.role === "billing");
    const jobsiteAddr = customerAddrs.find((a) => a.role === "jobsite");
    const mergedCustomer: Customer = {
      ...customerCoreRes.data,
      billing_address_line1: billingAddr?.line1 ?? null,
      billing_address_line2: billingAddr?.line2 ?? null,
      billing_postal_code: billingAddr?.postal_code ?? null,
      billing_city: billingAddr?.city ?? null,
      billing_country: billingAddr?.country ?? null,
      jobsite_address_line1: jobsiteAddr?.line1 ?? null,
      jobsite_address_line2: jobsiteAddr?.line2 ?? null,
      jobsite_postal_code: jobsiteAddr?.postal_code ?? null,
      jobsite_city: jobsiteAddr?.city ?? null,
      jobsite_country: jobsiteAddr?.country ?? null,
    };

    setQuote(loadedQuote);
    setQuoteGeneralForm(createInitialQuoteGeneralForm(loadedQuote));
    setItems((itemsRes.data ?? []) as QuoteItem[]);
    setRooms(loadedRooms);
    setRoomTemplates((roomTemplatesRes.data ?? []) as RoomTemplate[]);
    setRoomPhotos(photosResult.photos);
    setCompany(mergedCompany);
    setCustomer(mergedCustomer);
    setServices((servicesRes.data ?? []) as ServiceCatalogItem[]);
    setError(null);
  }

  async function reloadRoomPhotos() {
    const photosResult = await fetchRoomPhotos(rooms.map((room) => room.id));

    if (photosResult.error) {
      setError(photosResult.error);
      return false;
    }

    setRoomPhotos(photosResult.photos);
    return true;
  }

  function updateQuoteGeneralField<K extends keyof QuoteGeneralFormState>(
    field: K,
    value: QuoteGeneralFormState[K]
  ) {
    setQuoteGeneralForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateItemField<K extends keyof QuoteItemFormState>(
    field: K,
    value: QuoteItemFormState[K]
  ) {
    setItemForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function updateRoomField<K extends keyof RoomFormState>(
    field: K,
    value: RoomFormState[K]
  ) {
    setRoomForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function resetQuoteGeneralForm() {
    setQuoteGeneralForm(createInitialQuoteGeneralForm(quote));
    setError(null);
  }

  function applyCompanyDefaultsToQuote() {
    if (!company) return;

    setQuoteGeneralForm((prev) => ({
      ...prev,
      tva_rate: String(company.default_tva_rate ?? 21),
      valid_until: getDefaultValidUntil(
        company.default_quote_validity_days ?? 30
      ),
      notes: company.default_notes ?? "",
      terms: company.default_terms ?? "",
    }));
    setError(null);
  }

  async function handleSaveQuoteGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quote) {
      setError("Devis introuvable.");
      return;
    }

    if (!quoteGeneralForm.title.trim()) {
      setError("Le titre du devis est obligatoire.");
      return;
    }

    if (!quoteGeneralForm.customer_id) {
      setError("Le client du devis est obligatoire.");
      return;
    }

    setSavingGeneral(true);
    setError(null);

    const payload = {
      customer_id: quoteGeneralForm.customer_id,
      title: quoteGeneralForm.title.trim(),
      description: quoteGeneralForm.description.trim() || null,
      status: quoteGeneralForm.status,
      issue_date: quoteGeneralForm.issue_date,
      valid_until: quoteGeneralForm.valid_until || null,
      tva_rate: Number(quoteGeneralForm.tva_rate || 21),
      notes: quoteGeneralForm.notes.trim() || null,
      terms: quoteGeneralForm.terms.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("quotes")
      .update(payload)
      .eq("id", quote.id);

    if (updateError) {
      setError(updateError.message);
      setSavingGeneral(false);
      return;
    }

    setSavingGeneral(false);
    await reloadQuoteData();
  }

  async function handleCreateInvoiceFromQuote() {
    if (!quoteId) {
      setError("Devis introuvable.");
      return;
    }

    if (items.length === 0) {
      setError("Impossible de créer une facture à partir d'un devis sans ligne.");
      return;
    }

    setCreatingInvoice(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("create_invoice_from_quote", {
      p_quote_id: quoteId,
      p_invoice_type: "invoice",
    });

    if (rpcError) {
      setError(rpcError.message);
      setCreatingInvoice(false);
      return;
    }

    setCreatingInvoice(false);
    await reloadQuoteData();
  }

  function openCreateItemForm() {
    setEditingItemId(null);
    setItemForm(createInitialItemForm(quote?.tva_rate ?? 21));
    setError(null);
    setShowItemForm(true);
    setShowCatalogPicker(false);
  }

  function openEditItemForm(item: QuoteItem) {
    setEditingItemId(item.id);
    setItemForm(mapItemToForm(item));
    setError(null);
    setShowItemForm(true);
    setShowCatalogPicker(false);
  }

  function closeItemForm() {
    setShowItemForm(false);
    setEditingItemId(null);
    setError(null);
  }

  function openRoomForm() {
    setRoomForm(createInitialRoomForm());
    setError(null);
    setShowRoomForm(true);
  }

  function closeRoomForm() {
    setShowRoomForm(false);
    setError(null);
  }

  function openCatalogPicker() {
    setShowCatalogPicker(true);
    setShowItemForm(false);
    setEditingItemId(null);
    setError(null);
  }

  function closeCatalogPicker() {
    setShowCatalogPicker(false);
    setError(null);
  }

  function openMoveItem(item: QuoteItem) {
    setMovingItem(item);
    setMoveRoomId(item.room_id || "");
    setError(null);
  }

  function closeMoveItem() {
    setMovingItem(null);
    setMoveRoomId("");
    setError(null);
  }

  async function handleMoveItem() {
    if (!movingItem) {
      setError("Aucune ligne sélectionnée.");
      return;
    }

    setMovingItemLoading(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("quote_items")
      .update({
        room_id: moveRoomId || null,
      })
      .eq("id", movingItem.id);

    if (updateError) {
      setError(updateError.message);
      setMovingItemLoading(false);
      return;
    }

    setMovingItemLoading(false);
    closeMoveItem();
    await reloadQuoteData();
  }

  async function handleAddRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quoteId) {
      setError("Devis introuvable.");
      return;
    }

    if (!roomForm.name.trim()) {
      setError("Le nom de la pièce est obligatoire.");
      return;
    }

    setSavingRoom(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setSavingRoom(false);
      return;
    }

    const payload = {
      quote_id: quoteId,
      owner_user_id: user.id,
      name: roomForm.name,
      sort_order: getNextSortOrder(rooms.map((room) => room.sort_order)),
      notes: roomForm.notes || null,
    };

    const { error: insertError } = await supabase
      .from("quote_rooms")
      .insert(payload);

    if (insertError) {
      setError(insertError.message);
      setSavingRoom(false);
      return;
    }

    setRoomForm(createInitialRoomForm());
    setShowRoomForm(false);
    setSavingRoom(false);
    await reloadQuoteData();
  }

  async function handleSaveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quoteId || !quote) {
      setError("Devis introuvable.");
      return;
    }

    setSavingItem(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setSavingItem(false);
      return;
    }

    if (!itemForm.label.trim()) {
      setError("Le libellé de la ligne est obligatoire.");
      setSavingItem(false);
      return;
    }

    const payload = {
      quote_id: quoteId,
      room_id: itemForm.room_id || null,
      owner_user_id: user.id,
      item_type: itemForm.item_type,
      category: itemForm.category || null,
      label: itemForm.label,
      description: itemForm.description || null,
      unit: itemForm.unit,
      quantity: Number(itemForm.quantity || 0),
      unit_price_ht: Number(itemForm.unit_price_ht || 0),
      tva_rate: Number(itemForm.tva_rate || quote.tva_rate || 21),
      metadata: {},
    };

    if (editingItemId) {
      const { error: updateError } = await supabase
        .from("quote_items")
        .update(payload)
        .eq("id", editingItemId);

      if (updateError) {
        setError(updateError.message);
        setSavingItem(false);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("quote_items").insert({
        ...payload,
        sort_order: getNextSortOrder(items.map((item) => item.sort_order)),
      });

      if (insertError) {
        setError(insertError.message);
        setSavingItem(false);
        return;
      }
    }

    setItemForm(createInitialItemForm(quote.tva_rate ?? 21));
    setShowItemForm(false);
    setEditingItemId(null);
    setSavingItem(false);
    await reloadQuoteData();
  }

  async function handleAddFromCatalog(
    service: ServiceCatalogItem,
    quantity?: number
  ) {
    if (!quoteId || !quote) {
      setError("Devis introuvable.");
      return;
    }

    setAddingCatalogServiceId(service.id);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setAddingCatalogServiceId(null);
      return;
    }

    const { error: insertError } = await supabase.from("quote_items").insert({
      quote_id: quoteId,
      room_id: catalogRoomId || null,
      owner_user_id: user.id,
      item_type: "service",
      category: service.category || null,
      label: service.name,
      description: service.default_description || null,
      unit: service.default_unit,
      quantity: Number.isFinite(quantity) ? quantity : 1,
      unit_price_ht: Number(service.default_unit_price_ht || 0),
      tva_rate: Number(service.default_tva_rate || quote.tva_rate || 21),
      metadata: {
        source: "service_catalog",
        service_catalog_id: service.id,
        service_catalog_snapshot: {
          name: service.name,
          category: service.category,
          default_unit: service.default_unit,
          default_unit_price_ht: service.default_unit_price_ht,
          default_tva_rate: service.default_tva_rate,
        },
      },
      sort_order: getNextSortOrder(items.map((item) => item.sort_order)),
    });

    if (insertError) {
      setError(insertError.message);
      setAddingCatalogServiceId(null);
      return;
    }

    setAddingCatalogServiceId(null);
    await reloadQuoteData();
  }

  async function handleDuplicateItem(item: QuoteItem) {
    if (!quoteId) {
      setError("Devis introuvable.");
      return;
    }

    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      return;
    }

    const sourceSortOrder = item.sort_order;

    const reorderedItems = items.map((currentItem) => {
      if (currentItem.sort_order > sourceSortOrder) {
        return {
          ...currentItem,
          sort_order: currentItem.sort_order + 1,
        };
      }

      return currentItem;
    });

    const itemsToShift = reorderedItems.filter(
      (currentItem) =>
        currentItem.id !== item.id && currentItem.sort_order > sourceSortOrder
    );

    for (const itemToShift of itemsToShift) {
      const { error: shiftError } = await supabase
        .from("quote_items")
        .update({ sort_order: itemToShift.sort_order })
        .eq("id", itemToShift.id);

      if (shiftError) {
        setError(shiftError.message);
        return;
      }
    }

    const duplicatedPayload = {
      quote_id: item.quote_id,
      room_id: item.room_id,
      owner_user_id: user.id,
      item_type: item.item_type,
      category: item.category,
      label: `${item.label} (copie)`,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unit_price_ht: item.unit_price_ht,
      tva_rate: item.tva_rate,
      metadata: {
        source: "duplicate",
        duplicated_from_item_id: item.id,
      },
      sort_order: sourceSortOrder + 1,
    };

    const { error: insertError } = await supabase
      .from("quote_items")
      .insert(duplicatedPayload);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await reloadQuoteData();
  }

  async function handleDeleteItem(itemId: string) {
    const confirmed = window.confirm("Supprimer cette ligne du devis ?");
    if (!confirmed) return;

    setDeletingItemId(itemId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("quote_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingItemId(null);
      return;
    }

    setDeletingItemId(null);
    await reloadQuoteData();
  }

  async function handleUploadRoomPhotos(roomId: string, selectedFiles: File[]) {
    if (!quoteId || !quote) {
      setError("Devis introuvable.");
      return false;
    }

    if (selectedFiles.length === 0) return false;

    const unsupportedFile = selectedFiles.find(
      (file) => !ROOM_PHOTO_MIME_TYPES.has(file.type),
    );
    if (unsupportedFile) {
      setError(
        `Le fichier « ${unsupportedFile.name} » n'est pas au format JPG, PNG ou WebP.`,
      );
      return false;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > MAX_ROOM_PHOTO_SIZE,
    );
    if (oversizedFile) {
      setError(`Le fichier « ${oversizedFile.name} » dépasse la limite de 10 Mo.`);
      return false;
    }

    setUploadingPhotoRoomId(roomId);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setUploadingPhotoRoomId(null);
      return false;
    }

    const roomPhotoOrders = roomPhotos
      .filter((photo) => photo.room_id === roomId)
      .map((photo) => photo.sort_order);
    const firstSortOrder = getNextSortOrder(roomPhotoOrders);

    try {
      for (const [index, file] of selectedFiles.entries()) {
        const extension = ROOM_PHOTO_MIME_TYPES.get(file.type);
        if (!extension) continue;

        const storagePath = `${user.id}/${quoteId}/${roomId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(ROOM_PHOTOS_BUCKET)
          .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Stockage Supabase : ${uploadError.message}`);
        }

        const { error: metadataError } = await supabase
          .from("quote_room_photos")
          .insert({
            room_id: roomId,
            uploaded_by: user.id,
            storage_path: storagePath,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
            caption: null,
            sort_order: firstSortOrder + index,
          });

        if (metadataError) {
          await supabase.storage.from(ROOM_PHOTOS_BUCKET).remove([storagePath]);
          throw new Error(`Enregistrement de la photo : ${metadataError.message}`);
        }
      }

      return await reloadRoomPhotos();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Impossible d'importer les photos.",
      );
      await reloadRoomPhotos();
      return false;
    } finally {
      setUploadingPhotoRoomId(null);
    }
  }

  async function handleLoadRoomGallery(roomId: string) {
    const photos = roomPhotos.filter((photo) => photo.room_id === roomId);
    if (photos.length === 0) return [] as RoomPhotoWithUrl[];

    setError(null);

    const { data, error: signedUrlError } = await supabase.storage
      .from(ROOM_PHOTOS_BUCKET)
      .createSignedUrls(
        photos.map((photo) => photo.storage_path),
        60 * 60,
      );

    if (signedUrlError || !data) {
      setError(signedUrlError?.message ?? "Impossible d'ouvrir la galerie.");
      return [] as RoomPhotoWithUrl[];
    }

    const signedUrls = new Map(
      data
        .filter((item) => item.path && item.signedUrl && !item.error)
        .map((item) => [item.path as string, item.signedUrl]),
    );

    return photos.flatMap((photo) => {
      const signedUrl = signedUrls.get(photo.storage_path);
      return signedUrl ? [{ ...photo, signed_url: signedUrl }] : [];
    });
  }

  async function handleDeleteRoomPhoto(photo: RoomPhoto) {
    const confirmed = window.confirm("Supprimer cette photo ?");
    if (!confirmed) return false;

    setDeletingPhotoId(photo.id);
    setError(null);

    const { error: storageError } = await supabase.storage
      .from(ROOM_PHOTOS_BUCKET)
      .remove([photo.storage_path]);

    if (storageError) {
      setError(storageError.message);
      setDeletingPhotoId(null);
      return false;
    }

    const { error: metadataError } = await supabase
      .from("quote_room_photos")
      .delete()
      .eq("id", photo.id);

    if (metadataError) {
      setError(metadataError.message);
      setDeletingPhotoId(null);
      return false;
    }

    setRoomPhotos((current) => current.filter((item) => item.id !== photo.id));
    setDeletingPhotoId(null);
    return true;
  }

  async function handleDeleteRoom(roomId: string) {
    const roomHasItems = items.some((item) => item.room_id === roomId);

    if (roomHasItems) {
      setError(
        "Impossible de supprimer une pièce qui contient encore des lignes."
      );
      return;
    }

    const roomHasPhotos = roomPhotos.some((photo) => photo.room_id === roomId);

    if (roomHasPhotos) {
      setError(
        "Impossible de supprimer une pièce qui contient encore des photos. Supprimez d'abord les photos depuis la galerie.",
      );
      return;
    }

    const confirmed = window.confirm("Supprimer cette pièce ?");
    if (!confirmed) return;

    setDeletingRoomId(roomId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("quote_rooms")
      .delete()
      .eq("id", roomId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingRoomId(null);
      return;
    }

    setDeletingRoomId(null);
    await reloadQuoteData();
  }

  async function handleDuplicateRoom(roomId: string) {
    if (duplicatingRoomId) return;

    setDuplicatingRoomId(roomId);
    setError(null);

    const { error: duplicateError } = await supabase.rpc(
      "duplicate_quote_room",
      { p_room_id: roomId },
    );

    if (duplicateError) {
      setError(duplicateError.message);
      setDuplicatingRoomId(null);
      return;
    }

    await reloadQuoteData();
    setDuplicatingRoomId(null);
  }

  async function handleSaveRoomTemplate(roomId: string) {
    if (savingRoomTemplateId) return;

    const room = rooms.find((currentRoom) => currentRoom.id === roomId);
    if (!room) {
      setError("Pièce introuvable.");
      return;
    }

    const requestedName = window.prompt(
      "Nom du modèle de pièce",
      `${room.name} standard`,
    );
    const templateName = requestedName?.trim();
    if (!templateName) return;

    setSavingRoomTemplateId(roomId);
    setError(null);

    const { error: createTemplateError } = await supabase.rpc(
      "create_quote_room_template",
      {
        p_room_id: roomId,
        p_template_name: templateName,
      },
    );

    if (createTemplateError) {
      setError(createTemplateError.message);
      setSavingRoomTemplateId(null);
      return;
    }

    await reloadQuoteData();
    setSavingRoomTemplateId(null);
  }

  async function handleInsertRoomTemplate(templateId: string) {
    if (!quoteId || insertingRoomTemplateId) return;

    setInsertingRoomTemplateId(templateId);
    setError(null);

    const { error: insertTemplateError } = await supabase.rpc(
      "insert_quote_room_template",
      {
        p_quote_id: quoteId,
        p_template_id: templateId,
      },
    );

    if (insertTemplateError) {
      setError(insertTemplateError.message);
      setInsertingRoomTemplateId(null);
      return;
    }

    await reloadQuoteData();
    setInsertingRoomTemplateId(null);
  }

  async function handleDownloadPdf() {
    if (!quote) return;

    setDownloadingPdf(true);
    setError(null);

    try {
      const pdfData: QuotePdfData = {
        company,
        customer,
        quote: {
          quote_number: quote.quote_number,
          title: quote.title,
          description: quote.description,
          issue_date: quote.issue_date,
          valid_until: quote.valid_until,
          notes: quote.notes,
          terms: quote.terms,
          subtotal_ht: quote.subtotal_ht,
          total_tva: quote.total_tva,
          total_ttc: quote.total_ttc,
          tva_rate: quote.tva_rate,
          pdf_font_size_adjustment: quote.pdf_font_size_adjustment,
          pdf_other_section_position: quote.pdf_other_section_position,
        },
        rooms,
        items: items.map((item) => ({
          id: item.id,
          room_id: item.room_id,
          label: item.label,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unit_price_ht: item.unit_price_ht,
          tva_rate: item.tva_rate,
        })),
      };

      const pdf = await generateQuotePdf(pdfData, company?.pdf_theme, company?.pdf_color_mode ?? true, company?.pdf_accent_color);
      pdf.download(`${quote.quote_number}.pdf`);
    } catch (err) {
      console.error(err);
      setError("Impossible de générer le PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleSetPdfFontSize(adjustment: -1 | 0 | 1) {
    if (!quote || savingPdfFontSize) return;

    if (quote.pdf_font_size_adjustment === adjustment) return;

    setSavingPdfFontSize(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("quotes")
      .update({ pdf_font_size_adjustment: adjustment })
      .eq("id", quote.id);

    if (updateError) {
      setError(updateError.message);
      setSavingPdfFontSize(false);
      return;
    }

    setQuote((current) =>
      current
        ? { ...current, pdf_font_size_adjustment: adjustment }
        : current,
    );
    setSavingPdfFontSize(false);
  }

  async function handleSaveQuoteOrder(
    roomOrder: string[],
    itemOrder: string[],
    roomPageBreaks: Record<string, QuoteRoomPageBreak>,
    itemEdits: Record<string, QuoteItemInlineEdit>,
    otherSectionPosition: number | null,
  ): Promise<string | null> {
    if (!quoteId || savingQuoteOrder) {
      return "Le devis ne peut pas être réorganisé pour le moment.";
    }

    setSavingQuoteOrder(true);
    setError(null);

    const { error: saveOrderError } = await supabase.rpc("save_quote_editor", {
      p_quote_id: quoteId,
      p_room_order: roomOrder,
      p_item_order: itemOrder,
      p_room_page_breaks: roomPageBreaks,
      p_item_edits: itemEdits,
      p_other_section_position: otherSectionPosition,
    });

    if (saveOrderError) {
      setError(saveOrderError.message);
      setSavingQuoteOrder(false);
      return saveOrderError.message;
    }

    await reloadQuoteData();
    setSavingQuoteOrder(false);
    return null;
  }

  const roomMap = useMemo(() => {
    return new Map(rooms.map((room) => [room.id, room.name]));
  }, [rooms]);

  return {
    quoteId,
    quote,
    items,
    rooms,
    roomTemplates,
    roomPhotos,
    company,
    customer,
    customerOptions,
    services,

    loading,
    savingGeneral,
    savingItem,
    savingRoom,
    deletingItemId,
    deletingRoomId,
    duplicatingRoomId,
    savingRoomTemplateId,
    insertingRoomTemplateId,
    uploadingPhotoRoomId,
    deletingPhotoId,
    downloadingPdf,
    creatingInvoice,
    addingCatalogServiceId,
    movingItem,
    moveRoomId,
    movingItemLoading,
    savingPdfFontSize,
    savingQuoteOrder,

    error,
    showItemForm,
    showRoomForm,
    showCatalogPicker,
    editingItemId,

    catalogSearch,
    catalogCategory,
    catalogRoomId,

    quoteGeneralForm,
    itemForm,
    roomForm,
    roomMap,

    reloadQuoteData,

    updateQuoteGeneralField,
    updateItemField,
    updateRoomField,

    resetQuoteGeneralForm,
    applyCompanyDefaultsToQuote,

    handleSaveQuoteGeneral,
    handleCreateInvoiceFromQuote,

    openCreateItemForm,
    openEditItemForm,
    closeItemForm,

    openRoomForm,
    closeRoomForm,

    openCatalogPicker,
    closeCatalogPicker,

    openMoveItem,
    closeMoveItem,

    handleMoveItem,
    handleAddRoom,
    handleSaveItem,
    handleAddFromCatalog,
    handleDuplicateItem,
    handleDeleteItem,
    handleDeleteRoom,
    handleDuplicateRoom,
    handleSaveRoomTemplate,
    handleInsertRoomTemplate,
    handleUploadRoomPhotos,
    handleLoadRoomGallery,
    handleDeleteRoomPhoto,
    handleDownloadPdf,
    handleSetPdfFontSize,
    handleSaveQuoteOrder,

    setCatalogSearch,
    setCatalogCategory,
    setCatalogRoomId,
    setMoveRoomId,
  };
}
