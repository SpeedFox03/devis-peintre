import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerRow = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  billing_city: string | null;
  created_at: string;
  archived_at: string | null;
};

type QuoteCustomerRef = {
  customer_id: string;
};

export type CustomerFormState = {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  billing_address_line1: string;
  billing_postal_code: string;
  billing_city: string;
  notes: string;
};

export type CustomerSortField = "name" | "city" | "created_at";
export type SortDirection = "asc" | "desc";
export type QuotesFilter = "all" | "with_quotes" | "without_quotes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const initialForm: CustomerFormState = {
  company_name: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  billing_address_line1: "",
  billing_postal_code: "",
  billing_city: "",
  notes: "",
};

export function getCustomerName(customer: Pick<CustomerRow, "company_name" | "first_name" | "last_name">) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Sans nom"
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [quoteCountByCustomerId, setQuoteCountByCustomerId] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [archivingCustomerId, setArchivingCustomerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<CustomerSortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [quotesFilter, setQuotesFilter] = useState<QuotesFilter>("all");

  // ── Chargement initial ──────────────────────────────────────────────────────

  const loadCustomers = useCallback(async function loadCustomers() {
    setLoading(true);
    setError(null);

    const [customersRes, quotesRes] = await Promise.all([
      supabase
        .from("customers")
        .select("id, company_name, first_name, last_name, email, phone, billing_city, created_at, archived_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("quotes").select("customer_id"),
    ]);

    if (customersRes.error) {
      setError(customersRes.error.message);
      setLoading(false);
      return;
    }

    if (quotesRes.error) {
      setError(quotesRes.error.message);
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    ((quotesRes.data ?? []) as QuoteCustomerRef[]).forEach((quote) => {
      counts[quote.customer_id] = (counts[quote.customer_id] ?? 0) + 1;
    });

    setCustomers((customersRes.data ?? []) as CustomerRow[]);
    setQuoteCountByCustomerId(counts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  // ── Filtrage & tri ──────────────────────────────────────────────────────────

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = customers.filter((customer) => {
      const quoteCount = quoteCountByCustomerId[customer.id] ?? 0;

      if (quotesFilter === "with_quotes" && quoteCount === 0) return false;
      if (quotesFilter === "without_quotes" && quoteCount > 0) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        customer.company_name,
        customer.first_name,
        customer.last_name,
        customer.email,
        customer.phone,
        customer.billing_city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      if (sortField === "name") {
        comparison = getCustomerName(a).localeCompare(getCustomerName(b), "fr", { sensitivity: "base" });
      } else if (sortField === "city") {
        comparison = (a.billing_city || "").localeCompare(b.billing_city || "", "fr", { sensitivity: "base" });
      } else {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [customers, quoteCountByCustomerId, search, sortField, sortDirection, quotesFilter]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const customersWithQuotes = customers.filter((c) => (quoteCountByCustomerId[c.id] ?? 0) > 0).length;
    const customersWithoutQuotes = customers.filter((c) => (quoteCountByCustomerId[c.id] ?? 0) === 0).length;
    const totalQuotesLinked = Object.values(quoteCountByCustomerId).reduce((sum, count) => sum + count, 0);
    return { totalCustomers, customersWithQuotes, customersWithoutQuotes, totalQuotesLinked };
  }, [customers, quoteCountByCustomerId]);

  // ── Formulaire ──────────────────────────────────────────────────────────────

  function updateField<K extends keyof CustomerFormState>(field: K, value: CustomerFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openForm() {
    setForm(initialForm);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(initialForm);
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setSaving(false);
      return;
    }

    const payload = {
      owner_user_id: user.id,
      company_name: form.company_name || null,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      billing_address_line1: form.billing_address_line1 || null,
      billing_postal_code: form.billing_postal_code || null,
      billing_city: form.billing_city || null,
      billing_country: "Belgique",
      // Par défaut : adresse chantier = adresse facturation à la création.
      // L'utilisateur pourra la modifier ensuite sur la fiche client.
      jobsite_address_line1: form.billing_address_line1 || null,
      jobsite_postal_code: form.billing_postal_code || null,
      jobsite_city: form.billing_city || null,
      jobsite_country: "Belgique",
      notes: form.notes || null,
      archived_at: null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("customers")
      .insert(payload)
      .select("id, company_name, first_name, last_name, email, phone, billing_city, created_at, archived_at")
      .single();

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // ✅ Mise à jour locale — pas de rechargement complet
    setCustomers((prev) => [inserted as CustomerRow, ...prev]);
    setForm(initialForm);
    setShowForm(false);
    setSaving(false);
  }

  // ── Archivage ───────────────────────────────────────────────────────────────

  async function handleArchiveCustomer(customer: CustomerRow) {
    const confirmed = window.confirm("Archiver ce client ?");
    if (!confirmed) return;

    setArchivingCustomerId(customer.id);
    setError(null);

    const { error: updateError } = await supabase
      .from("customers")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setArchivingCustomerId(null);
      return;
    }

    // ✅ Retrait local — pas de rechargement complet
    setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    setArchivingCustomerId(null);
  }

  return {
    // État
    customers,
    quoteCountByCustomerId,
    filteredCustomers,
    loading,
    error,
    saving,
    archivingCustomerId,
    showForm,
    form,
    stats,
    // Filtres
    search, setSearch,
    sortField, setSortField,
    sortDirection, setSortDirection,
    quotesFilter, setQuotesFilter,
    // Actions
    updateField,
    openForm,
    closeForm,
    handleSubmit,
    handleArchiveCustomer,
  };
}
