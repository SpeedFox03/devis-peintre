import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CustomerDetails = {
  id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;

  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;

  jobsite_address_line1: string | null;
  jobsite_address_line2: string | null;
  jobsite_postal_code: string | null;
  jobsite_city: string | null;
  jobsite_country: string | null;

  notes: string | null;
  archived_at: string | null;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "invoiced";

export type CustomerQuote = {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
  issue_date: string;
  total_ttc: number;
};

export type CustomerFormState = {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;

  billing_address_line1: string;
  billing_address_line2: string;
  billing_postal_code: string;
  billing_city: string;
  billing_country: string;

  jobsite_address_line1: string;
  jobsite_address_line2: string;
  jobsite_postal_code: string;
  jobsite_city: string;
  jobsite_country: string;

  notes: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createInitialForm(customer: CustomerDetails | null): CustomerFormState {
  return {
    company_name: customer?.company_name ?? "",
    first_name: customer?.first_name ?? "",
    last_name: customer?.last_name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",

    billing_address_line1: customer?.billing_address_line1 ?? "",
    billing_address_line2: customer?.billing_address_line2 ?? "",
    billing_postal_code: customer?.billing_postal_code ?? "",
    billing_city: customer?.billing_city ?? "",
    billing_country: customer?.billing_country ?? "Belgique",

    jobsite_address_line1: customer?.jobsite_address_line1 ?? "",
    jobsite_address_line2: customer?.jobsite_address_line2 ?? "",
    jobsite_postal_code: customer?.jobsite_postal_code ?? "",
    jobsite_city: customer?.jobsite_city ?? "",
    jobsite_country: customer?.jobsite_country ?? "Belgique",

    notes: customer?.notes ?? "",
  };
}

export function getCustomerName(customer: Pick<CustomerDetails, "company_name" | "first_name" | "last_name">) {
  return (
    customer.company_name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    "Client sans nom"
  );
}

export function getStatusLabel(status: QuoteStatus) {
  const labels: Record<QuoteStatus, string> = {
    draft: "Brouillon",
    sent: "Envoyé",
    accepted: "Accepté",
    rejected: "Refusé",
    expired: "Expiré",
    invoiced: "Facturé",
  };
  return labels[status] ?? status;
}

export function formatCurrency(value: number) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export function buildAddress(parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(", ");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomerDetails() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [quotes, setQuotes] = useState<CustomerQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(createInitialForm(null));

  // ── isDirty : détecte les modifications non sauvegardées ───────────────────
  // Comparaison shallow de chaque champ texte entre le formulaire et le client chargé.
  const isDirty = useMemo(() => {
    if (!customer) return false;
    const baseline = createInitialForm(customer);
    return (Object.keys(baseline) as Array<keyof CustomerFormState>).some(
      (key) => form[key] !== baseline[key]
    );
  }, [form, customer]);

  // ── Chargement ─────────────────────────────────────────────────────────────

  const loadCustomerPage = useCallback(async function loadCustomerPage() {
    if (!customerId) {
      setError("Client introuvable.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [customerRes, quotesRes] = await Promise.all([
      supabase
        .from("customers")
        .select(
          `id, company_name, first_name, last_name, email, phone,
           billing_address_line1, billing_address_line2, billing_postal_code, billing_city, billing_country,
           jobsite_address_line1, jobsite_address_line2, jobsite_postal_code, jobsite_city, jobsite_country,
           notes, archived_at, created_at`
        )
        .eq("id", customerId)
        .single(),
      supabase
        .from("quotes")
        .select("id, quote_number, title, status, issue_date, total_ttc")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false }),
    ]);

    if (customerRes.error) {
      setError(customerRes.error.message);
      setLoading(false);
      return;
    }

    if (quotesRes.error) {
      setError(quotesRes.error.message);
      setLoading(false);
      return;
    }

    const loadedCustomer = customerRes.data as CustomerDetails;
    setCustomer(loadedCustomer);
    setQuotes((quotesRes.data ?? []) as CustomerQuote[]);
    setForm(createInitialForm(loadedCustomer));
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    void loadCustomerPage();
  }, [loadCustomerPage]);

  // ── Protection départ page avec modifications non sauvegardées ─────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // ── Formulaire ─────────────────────────────────────────────────────────────

  function updateField<K extends keyof CustomerFormState>(field: K, value: CustomerFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(createInitialForm(customer));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customer) {
      setError("Client introuvable.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      company_name: form.company_name || null,
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,

      billing_address_line1: form.billing_address_line1 || null,
      billing_address_line2: form.billing_address_line2 || null,
      billing_postal_code: form.billing_postal_code || null,
      billing_city: form.billing_city || null,
      billing_country: form.billing_country || null,

      jobsite_address_line1: form.jobsite_address_line1 || null,
      jobsite_address_line2: form.jobsite_address_line2 || null,
      jobsite_postal_code: form.jobsite_postal_code || null,
      jobsite_city: form.jobsite_city || null,
      jobsite_country: form.jobsite_country || null,

      notes: form.notes || null,
    };

    const { error: updateError } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // ✅ Mise à jour locale du customer — pas de rechargement complet
    const updatedCustomer: CustomerDetails = {
      ...customer,
      ...payload,
    };
    setCustomer(updatedCustomer);
    setForm(createInitialForm(updatedCustomer));
    setSaving(false);
  }

  // ── Archivage ───────────────────────────────────────────────────────────────

  async function handleArchiveCustomer() {
    if (!customer) {
      setError("Client introuvable.");
      return;
    }

    // Si des modifications non sauvegardées existent, on prévient l'utilisateur
    if (isDirty) {
      const confirmed = window.confirm(
        "Tu as des modifications non sauvegardées. Archiver quand même ce client ?"
      );
      if (!confirmed) return;
    } else {
      const confirmed = window.confirm("Archiver ce client ?");
      if (!confirmed) return;
    }

    setArchiving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("customers")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", customer.id);

    if (updateError) {
      setError(updateError.message);
      setArchiving(false);
      return;
    }

    setArchiving(false);
    navigate("/clients");
  }

  // ── Métriques ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const acceptedQuotesCount = quotes.filter((q) => q.status === "accepted").length;
    const totalPotentialSigned = quotes
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + Number(q.total_ttc || 0), 0);
    return { acceptedQuotesCount, totalPotentialSigned };
  }, [quotes]);

  // ── Adresses formatées ──────────────────────────────────────────────────────

  const addresses = useMemo(() => {
    if (!customer) return { billingAddress: "", jobsiteAddress: "" };
    return {
      billingAddress: buildAddress([
        customer.billing_address_line1,
        customer.billing_address_line2,
        customer.billing_postal_code,
        customer.billing_city,
        customer.billing_country,
      ]),
      jobsiteAddress: buildAddress([
        customer.jobsite_address_line1,
        customer.jobsite_address_line2,
        customer.jobsite_postal_code,
        customer.jobsite_city,
        customer.jobsite_country,
      ]),
    };
  }, [customer]);

  return {
    // État
    customer,
    quotes,
    loading,
    saving,
    archiving,
    error,
    form,
    isDirty,
    stats,
    addresses,
    // Actions
    updateField,
    resetForm,
    handleSubmit,
    handleArchiveCustomer,
  };
}
