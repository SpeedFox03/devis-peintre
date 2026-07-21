import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import type { ServiceCatalogItem } from "../../catalog/types";
import { generateQuotePdf } from "../pdf/generateQuotePdf";
import type { QuotePdfData } from "../pdf/quotePdfTypes";
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
} from "../types";
import {
  createInitialItemForm,
  createInitialQuoteGeneralForm,
  createInitialRoomForm,
  getDefaultValidUntil,
  getNextSortOrder,
  mapItemToForm,
} from "../utils/quoteDetailsForm";

export function useQuoteDetailsPage() {
  const { quoteId } = useParams();

  const [quote, setQuote] = useState<QuoteDetails | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [addingCatalogServiceId, setAddingCatalogServiceId] = useState<string | null>(null);
  const [movingItem, setMovingItem] = useState<QuoteItem | null>(null);
  const [moveRoomId, setMoveRoomId] = useState("");
  const [movingItemLoading, setMovingItemLoading] = useState(false);

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
          "id, quote_number, title, description, status, issue_date, valid_until, tva_rate, notes, terms, subtotal_ht, total_tva, total_ttc, customer_id, company_id"
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
        itemsRes, roomsRes, servicesRes, customerOptionsRes,
        companyCoreRes, companySettingsRes, companyAddrRes,
        customerCoreRes, customerAddrsRes,
      ] = await Promise.all([
        supabase
          .from("quote_items")
          .select("id, quote_id, room_id, item_type, category, label, description, unit, quantity, unit_price_ht, tva_rate, sort_order")
          .eq("quote_id", quoteId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("quote_rooms")
          .select("id, name, sort_order")
          .eq("quote_id", quoteId)
          .order("sort_order", { ascending: true }),
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
      if (servicesRes.error) { setError(servicesRes.error.message); setLoading(false); return; }
      if (customerOptionsRes.error) { setError(customerOptionsRes.error.message); setLoading(false); return; }
      if (companyCoreRes.error) { setError(companyCoreRes.error.message); setLoading(false); return; }
      if (customerCoreRes.error) { setError(customerCoreRes.error.message); setLoading(false); return; }

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
      setRooms((roomsRes.data ?? []) as Room[]);
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
        "id, quote_number, title, description, status, issue_date, valid_until, tva_rate, notes, terms, subtotal_ht, total_tva, total_ttc, customer_id, company_id"
      )
      .eq("id", quoteId)
      .single();

    if (quoteRes.error) {
      setError(quoteRes.error.message);
      return;
    }

    const loadedQuote = quoteRes.data as QuoteDetails;

    const [
      itemsRes, roomsRes, servicesRes,
      companyCoreRes, companySettingsRes, companyAddrRes,
      customerCoreRes, customerAddrsRes,
    ] = await Promise.all([
      supabase
        .from("quote_items")
        .select("id, quote_id, room_id, item_type, category, label, description, unit, quantity, unit_price_ht, tva_rate, sort_order")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_rooms")
        .select("id, name, sort_order")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true }),
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
    if (servicesRes.error) { setError(servicesRes.error.message); return; }
    if (companyCoreRes.error) { setError(companyCoreRes.error.message); return; }
    if (customerCoreRes.error) { setError(customerCoreRes.error.message); return; }

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
    setRooms((roomsRes.data ?? []) as Room[]);
    setCompany(mergedCompany);
    setCustomer(mergedCustomer);
    setServices((servicesRes.data ?? []) as ServiceCatalogItem[]);
    setError(null);
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

  async function handleDeleteRoom(roomId: string) {
    const roomHasItems = items.some((item) => item.room_id === roomId);

    if (roomHasItems) {
      setError(
        "Impossible de supprimer une pièce qui contient encore des lignes."
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

  const roomMap = useMemo(() => {
    return new Map(rooms.map((room) => [room.id, room.name]));
  }, [rooms]);

  return {
    quoteId,
    quote,
    items,
    rooms,
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
    downloadingPdf,
    creatingInvoice,
    addingCatalogServiceId,
    movingItem,
    moveRoomId,
    movingItemLoading,

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
    handleDownloadPdf,

    setCatalogSearch,
    setCatalogCategory,
    setCatalogRoomId,
    setMoveRoomId,
  };
}
