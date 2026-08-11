import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabase";
import { LoadingBlock } from "../../../components/ui/LoadingBlock/LoadingBlock";
import { ErrorMessage } from "../../../components/ui/ErrorMessage/ErrorMessage";
import { Button } from "../../../components/ui/Button/Button";
import { Card } from "../../../components/ui/Card/Card";
import { FormField } from "../../../components/ui/FormField/FormField";
import { FormGrid } from "../../../components/ui/FormGrid/FormGrid";
import { TextArea } from "../../../components/ui/TextArea/TextArea";
import { TextInput } from "../../../components/ui/TextInput/TextInput";
import { EmailSettingsPanel } from "../components/EmailSettingsPanel";
import { SubscriptionPanel } from "../components/SubscriptionPanel";
import { env } from "../../../lib/env";
import "./SettingsPage.css";

// ─── Tab pages ───────────────────────────────────────────────────────────────

const settingsPages = [
  { id: "informations", label: "Informations" },
  { id: "einvoicing",  label: "E-facturation" },
  { id: "apparence",    label: "Apparence" },
  { id: "emails",       label: "E-mails" },
  { id: "abonnement",   label: "Abonnement" },
] as const;

type SettingsPageId = (typeof settingsPages)[number]["id"];

// ─── Types ───────────────────────────────────────────────────────────────────

type CompanySettings = {
  id: string;
  address_id: string | null;
  name: string;
  enterprise_number: string | null;
  vat_number: string | null;
  country_code: string | null;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  iban: string | null;
  bic: string | null;
  default_tva_rate: number;
  default_quote_validity_days: number;
  default_terms: string | null;
  default_notes: string | null;
  default_deposit_percent: number;
  pdf_theme: string;
  pdf_accent_color: string | null;
  pdf_color_mode: boolean;
  legal_mentions: string | null;
  logo_url: string | null;
};

type CompanySettingsFormState = {
  name: string;
  enterprise_number: string;
  vat_number: string;
  country_code: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  postal_code: string;
  city: string;
  country: string;
  website: string;
  iban: string;
  bic: string;
  default_tva_rate: string;
  default_quote_validity_days: string;
  default_terms: string;
  default_notes: string;
  default_deposit_percent: string;
  pdf_theme: string;
  pdf_density: string;
  pdf_accent_color: string;
  pdf_color_mode: boolean;
  legal_mentions: string;
  logo_url: string;
};

type QuoteDesignOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  renderer_key: string;
};

type EinvoicingSetupForm = {
  legalEntityId: string;
  tenantId: string;
  peppolScheme: string;
  peppolIdentifier: string;
  connectionStatus: string;
};

const emptyEinvoicingSetup: EinvoicingSetupForm = {
  legalEntityId: "",
  tenantId: "",
  peppolScheme: "",
  peppolIdentifier: "",
  connectionStatus: "not_configured",
};

const PDF_THEME_OPTIONS: { value: string; label: string; description: string }[] = [
  {
    value: "normal",
    label: "Normal",
    description: "Mise en page structurée, tableau serré — idéal pour la plupart des devis",
  },
  {
    value: "aere",
    label: "Aéré",
    description: "Même structure, cellules plus généreuses — lecture facilitée",
  },
  {
    value: "compact",
    label: "Compact",
    description: "Tableau ultra-dense sur fond blanc — vise à tenir en 1 page",
  },
  {
    value: "elegant",
    label: "Élégant",
    description: "Papier crème, coups de pinceau et grand titre — pour une touche soignée",
  },
];

const PDF_DESIGN_OPTIONS = [
  {
    value: "standard",
    label: "Standard artisan",
    description: "Une présentation claire et professionnelle adaptée à tous les devis.",
  },
  {
    value: "elegant",
    label: "Élégant",
    description: "Papier crème, gestes de peinture et composition éditoriale.",
  },
] as const;

const PDF_DENSITY_OPTIONS = [
  { value: "compact", label: "Compact", description: "Plus de lignes par page" },
  { value: "normal", label: "Normal", description: "Équilibre par défaut" },
  { value: "aere", label: "Aéré", description: "Davantage d’espace" },
] as const;

function getPdfDesign(value: string) {
  return value === "elegant" ? "elegant" : "standard";
}

function getPdfDensity(value: string) {
  return value === "compact" || value === "aere" ? value : "normal";
}

function getPdfDesignLabel(value: string) {
  return getPdfDesign(value) === "elegant" ? "Élégant" : "Standard artisan";
}

function getPdfThemeLabel(value: string) {
  return PDF_THEME_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function createInitialForm(company: CompanySettings | null): CompanySettingsFormState {
  return {
    name: company?.name ?? "",
    enterprise_number: company?.enterprise_number ?? "",
    vat_number: company?.vat_number ?? "",
    country_code: company?.country_code ?? "BE",
    email: company?.email ?? "",
    phone: company?.phone ?? "",
    address_line1: company?.address_line1 ?? "",
    address_line2: company?.address_line2 ?? "",
    postal_code: company?.postal_code ?? "",
    city: company?.city ?? "",
    country: company?.country ?? "Belgique",
    website: company?.website ?? "",
    iban: company?.iban ?? "",
    bic: company?.bic ?? "",
    default_tva_rate: String(company?.default_tva_rate ?? 21),
    default_quote_validity_days: String(company?.default_quote_validity_days ?? 30),
    default_terms: company?.default_terms ?? "",
    default_notes: company?.default_notes ?? "",
    default_deposit_percent: String(company?.default_deposit_percent ?? 0),
    pdf_theme: company?.pdf_theme ?? "normal",
    pdf_density: getPdfDensity(company?.pdf_theme ?? "normal"),
    pdf_accent_color: company?.pdf_accent_color ?? "#8e7452",
    pdf_color_mode: company?.pdf_color_mode ?? true,
    legal_mentions: company?.legal_mentions ?? "",
    logo_url: company?.logo_url ?? "",
  };
}

// ─── SVG Theme previews ───────────────────────────────────────────────────────

function ThemePreviewNormal({ color = true }: { color?: boolean }) {
  const accent    = color ? "#8e7452" : "#1a1a1a";
  const accentSoft = color ? "#a88f6c" : "#555555";
  const bgPage    = color ? "#f8f5ef" : "#ffffff";
  const bgCard    = color ? "#fffdf9" : "#ffffff";
  const bgSection = color ? "#efe7db" : "#f0f0f0";
  const bgRoom    = color ? "#f6efe4" : "#e8e8e8";
  const bgRowAlt  = color ? "#f3ede3" : "#f8f8f8";
  const textDark  = color ? "#2f2a24" : "#111111";
  const textMuted = color ? "#6e6254" : "#666666";
  const border    = color ? "#d8cbb8" : "#d0d0d0";
  return (
    <svg
      viewBox="0 0 420 297"
      xmlns="http://www.w3.org/2000/svg"
      className="settings-premium-page__theme-preview-svg"
      role="img"
      aria-label="Aperçu thème Normal"
    >
      <rect width="420" height="297" fill={bgPage} rx="6" />

      {/* Company block */}
      <rect x="20" y="18" width="120" height="10" rx="3" fill={textDark} opacity="0.85" />
      <rect x="20" y="32" width="70" height="4" rx="2" fill={textMuted} opacity="0.5" />
      <rect x="20" y="39" width="90" height="4" rx="2" fill={textMuted} opacity="0.5" />
      <rect x="20" y="46" width="60" height="4" rx="2" fill={textMuted} opacity="0.5" />

      {/* Quote number card */}
      <rect x="296" y="16" width="104" height="52" rx="5" fill={bgSection} stroke={border} strokeWidth="1" />
      <rect x="306" y="24" width="28" height="4" rx="2" fill={accent} opacity="0.7" />
      <rect x="306" y="32" width="64" height="8" rx="2" fill={textDark} opacity="0.9" />
      <rect x="306" y="44" width="50" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="306" y="51" width="44" height="3" rx="1.5" fill={textMuted} opacity="0.5" />

      {/* Title centered */}
      <rect x="100" y="76" width="220" height="9" rx="3" fill={textDark} opacity="0.85" />
      <rect x="140" y="90" width="140" height="5" rx="2" fill={textMuted} opacity="0.4" />

      {/* Info cards */}
      <rect x="20" y="104" width="182" height="54" rx="5" fill={bgCard} stroke={border} strokeWidth="1" />
      <rect x="30" y="111" width="38" height="4" rx="2" fill={accent} opacity="0.65" />
      <rect x="30" y="118" width="3" height="18" rx="1" fill={accentSoft} opacity="0.5" />
      <rect x="36" y="120" width="110" height="5" rx="2" fill={textDark} opacity="0.8" />
      <rect x="36" y="129" width="140" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="36" y="135" width="120" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="36" y="141" width="90"  height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      <rect x="218" y="104" width="182" height="54" rx="5" fill={bgCard} stroke={border} strokeWidth="1" />
      <rect x="228" y="111" width="28" height="4" rx="2" fill={accent} opacity="0.65" />
      <rect x="228" y="118" width="3" height="18" rx="1" fill={accentSoft} opacity="0.5" />
      <rect x="234" y="120" width="130" height="5" rx="2" fill={textDark} opacity="0.8" />
      <rect x="234" y="129" width="100" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="234" y="135" width="115" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="234" y="141" width="80"  height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      {/* Section title */}
      <rect x="20" y="168" width="70" height="4" rx="2" fill={accent} opacity="0.6" />
      <rect x="20" y="176" width="100" height="7" rx="2" fill={textDark} opacity="0.8" />

      {/* Room table — tight rows (height 10 instead of 13) */}
      <rect x="20" y="190" width="380" height="13" rx="3" fill={bgRoom} />
      <rect x="20" y="190" width="3"   height="13" fill={accent} />
      <rect x="30" y="194" width="80"  height="5" rx="2" fill={textDark} opacity="0.75" />

      {/* Column headers */}
      <rect x="20" y="203" width="380" height="11" fill={bgSection} />
      {[0,1,2,3,4].map((i) => (
        <rect key={i} x={28 + i * 76} y={206} width={i === 0 ? 55 : 38} height="4" rx="1.5" fill={textMuted} opacity="0.6" />
      ))}

      {/* Table rows — tight (height=10, gap=10) */}
      {[0,1,2,3].map((i) => (
        <g key={i}>
          <rect x="20" y={214 + i * 10} width="380" height="10" fill={i % 2 === 0 ? bgCard : bgRowAlt} />
          <rect x="28" y={217 + i * 10} width={70 + i * 6} height="4" rx="1.5" fill={textDark} opacity="0.75" />
          <rect x="152" y={217 + i * 10} width="30" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="212" y={217 + i * 10} width="34" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="280" y={217 + i * 10} width="40" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="342" y={217 + i * 10} width="44" height="4" rx="1.5" fill={textDark} opacity="0.75" />
        </g>
      ))}

      {/* Totals */}
      <rect x="238" y="258" width="162" height="10" rx="2" fill={bgCard} stroke={border} strokeWidth="0.5" />
      <rect x="246" y="262" width="55" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="354" y="262" width="38" height="3" rx="1.5" fill={textDark} opacity="0.7" />
      <rect x="238" y="270" width="162" height="11" rx="2" fill={bgSection} stroke={border} strokeWidth="0.5" />
      <rect x="246" y="274" width="50" height="5" rx="2" fill={textDark} opacity="0.85" />
      <rect x="340" y="272" width="52" height="7" rx="2" fill={textDark} opacity="0.9" />

      {/* Footer */}
      <rect x="340" y="290" width="60" height="3" rx="1.5" fill={textMuted} opacity="0.3" />
    </svg>
  );
}

function ThemePreviewAere({ color = true }: { color?: boolean }) {
  const accent   = color ? "#8e7452" : "#1a1a1a";
  const accentSoft = color ? "#a88f6c" : "#555555";
  const bgPage   = color ? "#f8f5ef" : "#ffffff";
  const bgCard   = color ? "#fffdf9" : "#ffffff";
  const bgSection = color ? "#efe7db" : "#f0f0f0";
  const bgRoom   = color ? "#f6efe4" : "#e8e8e8";
  const bgRowAlt = color ? "#f3ede3" : "#f8f8f8";
  const textDark = color ? "#2f2a24" : "#111111";
  const textMuted = color ? "#6e6254" : "#666666";
  const border   = color ? "#d8cbb8" : "#d0d0d0";
  return (
    <svg
      viewBox="0 0 420 297"
      xmlns="http://www.w3.org/2000/svg"
      className="settings-premium-page__theme-preview-svg"
      role="img"
      aria-label="Aperçu thème Aéré"
    >
      <rect width="420" height="297" fill={bgPage} rx="6" />

      {/* Company block */}
      <rect x="20" y="18" width="120" height="10" rx="3" fill={textDark} opacity="0.85" />
      <rect x="20" y="32" width="70" height="4" rx="2" fill={textMuted} opacity="0.5" />
      <rect x="20" y="39" width="90" height="4" rx="2" fill={textMuted} opacity="0.5" />
      <rect x="20" y="46" width="60" height="4" rx="2" fill={textMuted} opacity="0.5" />

      {/* Quote number card */}
      <rect x="296" y="16" width="104" height="52" rx="5" fill={bgSection} stroke={border} strokeWidth="1" />
      <rect x="306" y="24" width="28" height="4" rx="2" fill={accent} opacity="0.7" />
      <rect x="306" y="32" width="64" height="8" rx="2" fill={textDark} opacity="0.9" />
      <rect x="306" y="44" width="50" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="306" y="51" width="44" height="3" rx="1.5" fill={textMuted} opacity="0.5" />

      {/* Accent rule */}
      <rect x="20" y="72" width="380" height="1.5" rx="1" fill={accent} opacity="0.45" />

      {/* Title centered */}
      <rect x="100" y="82" width="220" height="9" rx="3" fill={textDark} opacity="0.85" />
      <rect x="140" y="96" width="140" height="5" rx="2" fill={textMuted} opacity="0.4" />

      {/* Info cards */}
      <rect x="20" y="110" width="182" height="58" rx="5" fill={bgCard} stroke={border} strokeWidth="1" />
      <rect x="30" y="118" width="38" height="4" rx="2" fill={accent} opacity="0.65" />
      <rect x="30" y="126" width="3" height="20" rx="1" fill={accentSoft} opacity="0.5" />
      <rect x="36" y="128" width="110" height="5" rx="2" fill={textDark} opacity="0.8" />
      <rect x="36" y="137" width="140" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="36" y="143" width="120" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="36" y="149" width="90" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="36" y="155" width="100" height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      <rect x="218" y="110" width="182" height="58" rx="5" fill={bgCard} stroke={border} strokeWidth="1" />
      <rect x="228" y="118" width="28" height="4" rx="2" fill={accent} opacity="0.65" />
      <rect x="228" y="126" width="3" height="20" rx="1" fill={accentSoft} opacity="0.5" />
      <rect x="234" y="128" width="130" height="5" rx="2" fill={textDark} opacity="0.8" />
      <rect x="234" y="137" width="100" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="234" y="143" width="115" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="234" y="149" width="80" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="234" y="155" width="90" height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      {/* Section title */}
      <rect x="20" y="178" width="70" height="4" rx="2" fill={accent} opacity="0.6" />
      <rect x="20" y="186" width="100" height="7" rx="2" fill={textDark} opacity="0.8" />

      {/* Room table */}
      <rect x="20" y="200" width="380" height="16" rx="3" fill={bgRoom} stroke={accent} strokeWidth="0.8" />
      <rect x="30" y="205" width="80" height="5" rx="2" fill={textDark} opacity="0.75" />

      {/* Column headers */}
      <rect x="20" y="216" width="380" height="13" rx="0" fill={bgSection} />
      {[0,1,2,3,4].map((i) => (
        <rect key={i} x={28 + i * 76} y={220} width={i === 0 ? 55 : 38} height="4" rx="1.5" fill={textMuted} opacity="0.6" />
      ))}

      {/* Table rows */}
      {[0,1,2].map((i) => (
        <g key={i}>
          <rect x="20" y={229 + i * 13} width="380" height="13" fill={i % 2 === 0 ? bgCard : bgRowAlt} />
          <rect x="28" y={233 + i * 13} width={80 + i * 8} height="4" rx="1.5" fill={textDark} opacity="0.75" />
          <rect x="152" y={233 + i * 13} width="34" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="212" y={233 + i * 13} width="38" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="280" y={233 + i * 13} width="44" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="342" y={233 + i * 13} width="48" height="4" rx="1.5" fill={textDark} opacity="0.75" />
        </g>
      ))}

      {/* Totals */}
      <rect x="238" y="270" width="162" height="11" rx="2" fill={bgCard} stroke={border} strokeWidth="0.5" />
      <rect x="246" y="274" width="55" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="354" y="274" width="38" height="3" rx="1.5" fill={textDark} opacity="0.7" />
      <rect x="238" y="283" width="162" height="12" rx="2" fill={bgSection} stroke={border} strokeWidth="0.5" />
      <rect x="246" y="287" width="50" height="5" rx="2" fill={textDark} opacity="0.85" />
      <rect x="340" y="285" width="52" height="7" rx="2" fill={textDark} opacity="0.9" />

      {/* Footer */}
      <rect x="340" y="293" width="60" height="3" rx="1.5" fill={textMuted} opacity="0.3" />
    </svg>
  );
}

function ThemePreviewCompact({ color = false }: { color?: boolean }) {
  const accent     = color ? "#8e7452" : "#1a1a1a";
  const accentSoft = color ? "#a88f6c" : "#555555";
  const bgPage     = color ? "#ffffff" : "#ffffff";
  const bgHeader   = color ? "#f6efe4" : "#f2f2f2";
  const bgRowAlt   = color ? "#f8f8f8" : "#f8f8f8";
  const textDark   = color ? "#2f2a24" : "#111111";
  const textMuted  = color ? "#6e6254" : "#666666";
  const border     = color ? "#d8cbb8" : "#d8d8d8";
  const colHdrBg   = color ? "#f6efe4" : "#ebebeb";
  const totalTint  = color ? "#f5f0eb" : "#f5f5f5";
  return (
    <svg
      viewBox="0 0 420 297"
      xmlns="http://www.w3.org/2000/svg"
      className="settings-premium-page__theme-preview-svg"
      role="img"
      aria-label="Aperçu thème Compact"
    >
      <rect width="420" height="297" fill={bgPage} rx="6" />

      {/* Company */}
      <rect x="20" y="16" width="80" height="7" rx="2" fill={textDark} opacity="0.85" />
      <rect x="20" y="27" width="60" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="20" y="33" width="72" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="20" y="39" width="52" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="20" y="45" width="64" height="3" rx="1.5" fill={textMuted} opacity="0.5" />

      {/* Quote number */}
      <rect x="163" y="16" width="28" height="3" rx="1.5" fill={accent} opacity="0.65" />
      <rect x="152" y="22" width="50" height="8" rx="2" fill={textDark} opacity="0.85" />
      <rect x="158" y="34" width="38" height="3" rx="1.5" fill={accentSoft} opacity="0.55" />
      <rect x="160" y="40" width="34" height="3" rx="1.5" fill={accentSoft} opacity="0.55" />

      {/* Client */}
      <rect x="332" y="16" width="38" height="3" rx="1.5" fill={accent} opacity="0.65" />
      <rect x="310" y="22" width="90" height="5" rx="2" fill={textDark} opacity="0.8" />
      <rect x="318" y="31" width="72" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="322" y="37" width="60" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="325" y="43" width="54" height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      {/* Bold separator — accent color */}
      <rect x="20" y="56" width="380" height="1.5" rx="0.5" fill={accent} opacity="0.9" />

      {/* Title centered */}
      <rect x="125" y="65" width="170" height="7" rx="2.5" fill={textDark} opacity="0.85" />
      <rect x="155" y="76" width="110" height="4" rx="1.5" fill={textMuted} opacity="0.4" />

      {/* Column headers */}
      <rect x="20" y="86" width="380" height="0.5" rx="0.3" fill={border} opacity="0.6" />
      <rect x="20" y="89" width="380" height="11" fill={colHdrBg} />
      <rect x="24" y="92" width="55" height="4" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="152" y="92" width="28" height="4" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="206" y="92" width="30" height="4" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="264" y="92" width="34" height="4" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="328" y="92" width="44" height="4" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="20" y="100" width="380" height="0.5" rx="0.3" fill={accent} opacity="0.5" />

      {/* Room 1 — left accent strip */}
      <rect x="20" y="102" width="380" height="11" fill={bgHeader} />
      <rect x="20" y="102" width="3" height="11" fill={accent} />
      <rect x="27" y="105" width="58" height="4" rx="1.5" fill={accent} opacity="0.8" />

      {[0,1,2].map((i) => (
        <g key={i}>
          <rect x="20" y={114 + i * 14} width="380" height="13" fill={i % 2 === 0 ? bgPage : bgRowAlt} />
          <rect x="24" y={118 + i * 14} width={55 + i * 12} height="4" rx="1.5" fill={textDark} opacity="0.75" />
          <rect x="152" y={118 + i * 14} width="26" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="206" y={118 + i * 14} width="28" height="4" rx="1.5" fill={textMuted} opacity="0.5" />
          <rect x="264" y={118 + i * 14} width="34" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="328" y={118 + i * 14} width="42" height="4" rx="1.5" fill={textDark} opacity="0.75" />
        </g>
      ))}

      {/* Room 2 — left accent strip */}
      <rect x="20" y="156" width="380" height="11" fill={bgHeader} />
      <rect x="20" y="156" width="3" height="11" fill={accent} />
      <rect x="27" y="159" width="48" height="4" rx="1.5" fill={accent} opacity="0.8" />

      {[0,1].map((i) => (
        <g key={i}>
          <rect x="20" y={168 + i * 13} width="380" height="12" fill={i % 2 === 0 ? bgPage : bgRowAlt} />
          <rect x="24" y={171 + i * 13} width={52 + i * 16} height="4" rx="1.5" fill={textDark} opacity="0.75" />
          <rect x="152" y={171 + i * 13} width="26" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="264" y={171 + i * 13} width="34" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="328" y={171 + i * 13} width="42" height="4" rx="1.5" fill={textDark} opacity="0.75" />
        </g>
      ))}

      {/* Totals */}
      <rect x="238" y="200" width="162" height="0.5" rx="0.3" fill={border} />
      <rect x="238" y="204" width="162" height="11" fill={bgPage} />
      <rect x="246" y="208" width="48" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="352" y="208" width="40" height="3" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="238" y="215" width="162" height="11" fill={bgPage} />
      <rect x="246" y="219" width="38" height="3" rx="1.5" fill={textMuted} opacity="0.5" />
      <rect x="352" y="219" width="40" height="3" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="238" y="228" width="162" height="1.2" rx="0.4" fill={accent} />
      <rect x="238" y="232" width="162" height="15" rx="2" fill={totalTint} />
      <rect x="238" y="232" width="3" height="15" fill={accent} />
      <rect x="246" y="236" width="54" height="5" rx="2" fill={textDark} opacity="0.88" />
      <rect x="334" y="234" width="58" height="8" rx="2" fill={accent} opacity="0.85" />

      {/* Notes / Conditions */}
      <rect x="20" y="254" width="58" height="4" rx="1.5" fill={accent} opacity="0.65" />
      <rect x="20" y="261" width="170" height="3" rx="1.5" fill={textMuted} opacity="0.38" />
      <rect x="20" y="267" width="140" height="3" rx="1.5" fill={textMuted} opacity="0.38" />
      <rect x="20" y="273" width="155" height="3" rx="1.5" fill={textMuted} opacity="0.38" />
      <rect x="218" y="254" width="62" height="4" rx="1.5" fill={accent} opacity="0.65" />
      <rect x="218" y="261" width="170" height="3" rx="1.5" fill={textMuted} opacity="0.38" />
      <rect x="218" y="267" width="140" height="3" rx="1.5" fill={textMuted} opacity="0.38" />
      <rect x="218" y="273" width="158" height="3" rx="1.5" fill={textMuted} opacity="0.38" />

      {/* Footer */}
      <rect x="20" y="286" width="80" height="3" rx="1.5" fill={accentSoft} opacity="0.3" />
      <rect x="340" y="286" width="60" height="3" rx="1.5" fill={accentSoft} opacity="0.3" />
    </svg>
  );
}

function ThemePreviewElegant({ color = true }: { color?: boolean }) {
  const accent     = color ? "#8a6244" : "#1a1a1a";
  const accentSoft = color ? "#b0996f" : "#555555";
  const bgPage     = color ? "#eae2d1" : "#ffffff";
  const bgPanel    = color ? "#ddd0b9" : "#f0f0f0";
  const textDark   = color ? "#403324" : "#111111";
  const textMuted  = color ? "#8a6f50" : "#666666";
  const border     = color ? "#cdbfa6" : "#d0d0d0";
  const stroke     = color ? "#f4efe6" : "#f4f4f4";
  return (
    <svg
      viewBox="0 0 420 297"
      xmlns="http://www.w3.org/2000/svg"
      className="settings-premium-page__theme-preview-svg"
      role="img"
      aria-label="Aperçu thème Élégant"
    >
      <rect width="420" height="297" fill={bgPage} rx="6" />

      {/* Coups de pinceau */}
      <path d="M 230 26 C 290 8 350 18 400 4 C 418 -2 420 14 412 30 C 380 42 320 36 270 50 C 240 58 230 40 230 30 Z" fill={stroke} fillOpacity="0.55" />
      <path d="M 250 22 C 300 8 360 18 410 6" stroke={stroke} strokeOpacity="0.5" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M -8 250 C 40 230 92 246 128 230 C 146 248 134 274 96 284 C 56 294 16 288 -8 274 Z" fill={stroke} fillOpacity="0.5" />
      <path d="M 0 258 C 44 242 90 252 124 240" stroke={stroke} strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Logo / nom société */}
      <rect x="22" y="22" width="96" height="12" rx="3" fill={textDark} opacity="0.85" />
      <rect x="22" y="40" width="40" height="3" rx="1.5" fill={accentSoft} opacity="0.7" />

      {/* DEVIS + badge + dates (droite) */}
      <rect x="288" y="22" width="110" height="16" rx="3" fill={textDark} opacity="0.85" />
      <rect x="318" y="46" width="80" height="16" rx="4" fill={bgPanel} />
      <rect x="338" y="51" width="42" height="6" rx="2" fill={accent} opacity="0.85" />
      <rect x="330" y="70" width="68" height="4" rx="2" fill={textMuted} opacity="0.6" />
      <rect x="346" y="79" width="52" height="4" rx="2" fill={textMuted} opacity="0.5" />

      {/* DE / POUR */}
      <rect x="22" y="104" width="20" height="3" rx="1.5" fill={accent} opacity="0.7" />
      <rect x="22" y="110" width="14" height="2" rx="1" fill={accentSoft} opacity="0.6" />
      <rect x="22" y="118" width="84" height="6" rx="2" fill={textDark} opacity="0.82" />
      <rect x="22" y="129" width="120" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="22" y="136" width="96" height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      <rect x="232" y="104" width="24" height="3" rx="1.5" fill={accent} opacity="0.7" />
      <rect x="232" y="110" width="14" height="2" rx="1" fill={accentSoft} opacity="0.6" />
      <rect x="232" y="118" width="96" height="6" rx="2" fill={textDark} opacity="0.82" />
      <rect x="232" y="129" width="120" height="3" rx="1.5" fill={textMuted} opacity="0.45" />
      <rect x="232" y="136" width="100" height="3" rx="1.5" fill={textMuted} opacity="0.45" />

      {/* En-tête de tableau */}
      <rect x="22" y="158" width="376" height="16" fill={bgPanel} />
      <rect x="30" y="164" width="60" height="4" rx="1.5" fill={textMuted} opacity="0.7" />
      <rect x="244" y="164" width="40" height="4" rx="1.5" fill={textMuted} opacity="0.6" />
      <rect x="300" y="164" width="36" height="4" rx="1.5" fill={textMuted} opacity="0.6" />
      <rect x="350" y="164" width="40" height="4" rx="1.5" fill={textMuted} opacity="0.6" />

      {/* Lignes (label + description) séparées par filets */}
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="30" y={182 + i * 24} width={90 + i * 18} height="5" rx="2" fill={textDark} opacity="0.8" />
          <rect x="30" y={190 + i * 24} width="150" height="3" rx="1.5" fill={textMuted} opacity="0.4" />
          <rect x="244" y={184 + i * 24} width="36" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="300" y={184 + i * 24} width="34" height="4" rx="1.5" fill={textDark} opacity="0.6" />
          <rect x="352" y={184 + i * 24} width="38" height="4" rx="1.5" fill={textDark} opacity="0.78" />
          <rect x="22" y={200 + i * 24} width="376" height="0.6" fill={border} />
        </g>
      ))}

      {/* Panneau totaux */}
      <rect x="248" y="252" width="150" height="36" rx="2" fill={bgPanel} />
      <rect x="258" y="258" width="56" height="3" rx="1.5" fill={textMuted} opacity="0.55" />
      <rect x="356" y="258" width="34" height="3" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="258" y="266" width="40" height="3" rx="1.5" fill={textMuted} opacity="0.55" />
      <rect x="362" y="266" width="28" height="3" rx="1.5" fill={textDark} opacity="0.65" />
      <rect x="256" y="273" width="134" height="1" fill={accent} />
      <rect x="258" y="278" width="44" height="6" rx="2" fill={textDark} opacity="0.85" />
      <rect x="346" y="276" width="46" height="9" rx="2" fill={accent} opacity="0.9" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  // Tab navigation
  const [activePage, setActivePage] = useState<SettingsPageId>("informations");
  const [topbarPortalTarget] = useState<Element | null>(() => document.querySelector(".app-topbar"));

  useEffect(() => {
    const topbar = topbarPortalTarget;
    topbar?.classList.add("app-topbar--with-quote-nav");
    return () => { topbar?.classList.remove("app-topbar--with-quote-nav"); };
  }, [topbarPortalTarget]);

  // Data state
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [form, setForm] = useState<CompanySettingsFormState>(createInitialForm(null));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [availableDesigns, setAvailableDesigns] = useState<QuoteDesignOption[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const canUseElegantDesign = form.pdf_theme === "elegant";
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [einvoicingSetup, setEinvoicingSetup] = useState<EinvoicingSetupForm>(emptyEinvoicingSetup);
  const [savingEinvoicing, setSavingEinvoicing] = useState(false);
  const [einvoicingMessage, setEinvoicingMessage] = useState<string | null>(null);

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !company) return;

    event.target.value = "";
    setUploadingLogo(true);
    setLogoUploadError(null);

    const ext = file.name.split(".").pop() ?? "png";
    const path = `${company.id}/${file.lastModified}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setLogoUploadError(uploadError.message);
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("company-logos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    const { error: dbError } = await supabase
      .from("companies")
      .update({ logo_url: publicUrl })
      .eq("id", company.id);

    if (dbError) {
      setLogoUploadError(dbError.message);
      setUploadingLogo(false);
      return;
    }

    updateField("logo_url", publicUrl);
    setCompany((prev) => prev ? { ...prev, logo_url: publicUrl } : prev);
    setUploadingLogo(false);
  }

  async function handleLogoRemove() {
    if (!company) return;
    updateField("logo_url", "");
    setCompany((prev) => prev ? { ...prev, logo_url: null } : prev);

    await supabase
      .from("companies")
      .update({ logo_url: null })
      .eq("id", company.id);
  }

  async function loadSettings() {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, enterprise_number, vat_number, country_code, email, phone, website, iban, bic, logo_url, legal_mentions, accent_color")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setCompany(null);
      setForm(createInitialForm(null));
      setAvailableDesigns([]);
      setSelectedDesignId(null);
      setEinvoicingSetup(emptyEinvoicingSetup);
      setLoading(false);
      return;
    }

    const [settingsRes, addrRes, einvoicingRes] = await Promise.all([
      supabase
        .from("company_settings")
        .select("pdf_theme, pdf_accent_color, pdf_color_mode, default_tva_rate, default_quote_validity_days, default_deposit_percent, default_terms, default_notes")
        .eq("company_id", data.id)
        .maybeSingle(),
      supabase
        .from("addresses")
        .select("id, line1, line2, postal_code, city, country")
        .eq("entity_id", data.id)
        .eq("entity_type", "company")
        .eq("role", "main")
        .maybeSingle(),
      supabase
        .from("company_einvoicing_profiles")
        .select("connection_status, storecove_legal_entity_id, storecove_tenant_id, peppol_scheme, peppol_identifier")
        .eq("company_id", data.id)
        .eq("environment", "sandbox")
        .maybeSingle(),
    ]);

    let assignedDesigns: QuoteDesignOption[] = [];
    let defaultDesignId: string | null = null;
    let defaultDensity: string | null = null;
    if (env.administrationEnabled) {
      const [designsRes, preferenceRes] = await Promise.all([
        supabase
          .from("quote_designs")
          .select("id, name, slug, description, renderer_key")
          .eq("active", true)
          .order("created_at"),
        supabase
          .from("company_quote_preferences")
          .select("default_design_id, default_density")
          .eq("company_id", data.id)
          .maybeSingle(),
      ]);
      if (designsRes.error || preferenceRes.error) {
        setError(designsRes.error?.message ?? preferenceRes.error?.message ?? "Impossible de charger les modèles de devis.");
        setLoading(false);
        return;
      }
      assignedDesigns = (designsRes.data ?? []) as QuoteDesignOption[];
      defaultDesignId = preferenceRes.data?.default_design_id ?? null;
      defaultDensity = preferenceRes.data?.default_density ?? null;
    }

    const loadedCompany: CompanySettings = {
      ...data,
      ...(settingsRes.data ?? {}),
      address_id: addrRes.data?.id ?? null,
      address_line1: addrRes.data?.line1 ?? null,
      address_line2: addrRes.data?.line2 ?? null,
      postal_code: addrRes.data?.postal_code ?? null,
      city: addrRes.data?.city ?? null,
      country: addrRes.data?.country ?? null,
    } as CompanySettings;

    setEinvoicingSetup({
      legalEntityId: einvoicingRes.data?.storecove_legal_entity_id
        ? String(einvoicingRes.data.storecove_legal_entity_id)
        : "",
      tenantId: einvoicingRes.data?.storecove_tenant_id ?? "",
      peppolScheme: einvoicingRes.data?.peppol_scheme ?? "",
      peppolIdentifier: einvoicingRes.data?.peppol_identifier ?? "",
      connectionStatus: einvoicingRes.data?.connection_status ?? "not_configured",
    });

    const selectedDesign = assignedDesigns.find((design) => design.id === defaultDesignId) ?? assignedDesigns[0] ?? null;
    if (selectedDesign) {
      loadedCompany.pdf_theme = selectedDesign.renderer_key === "elegant"
        ? "elegant"
        : getPdfDensity(defaultDensity ?? loadedCompany.pdf_theme);
    }

    setCompany(loadedCompany);
    const loadedForm = createInitialForm(loadedCompany);
    loadedForm.pdf_density = getPdfDensity(defaultDensity ?? loadedForm.pdf_theme);
    setForm(loadedForm);
    setAvailableDesigns(assignedDesigns);
    setSelectedDesignId(selectedDesign?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSettings(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateField<K extends keyof CompanySettingsFormState>(
    field: K,
    value: CompanySettingsFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(createInitialForm(company));
    setError(null);
  }

  async function handleCreateCompany() {
    setCreatingCompany(true);
    setError(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Utilisateur non connecté.");
      setCreatingCompany(false);
      return;
    }

    const { data: newCompany, error } = await supabase
      .from("companies")
      .insert({ owner_user_id: user.id, name: "Mon entreprise" })
      .select("id")
      .single();

    if (error || !newCompany) {
      setError(error?.message ?? "Impossible de créer l'entreprise.");
      setCreatingCompany(false);
      return;
    }

    await supabase.from("company_settings").insert({
      company_id: newCompany.id,
      pdf_theme: "normal",
      pdf_color_mode: true,
      default_tva_rate: 21,
      default_quote_validity_days: 30,
      default_deposit_percent: 0,
    });

    setCreatingCompany(false);
    await loadSettings();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!company) {
      setError("Aucune entreprise à mettre à jour.");
      return;
    }

    setSaving(true);
    setError(null);

    const name = form.name.trim();
    if (!name) {
      setError("Le nom de l'entreprise est obligatoire.");
      setSaving(false);
      return;
    }

    const {
      data: { user: currentUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      setError("Utilisateur non connecté.");
      setSaving(false);
      return;
    }

    const tva_rate = Number(form.default_tva_rate || 21);
    const validity_days = Number(form.default_quote_validity_days || 30);
    const deposit_percent = Number(form.default_deposit_percent || 0);
    const terms = form.default_terms.trim() || null;
    const notes = form.default_notes.trim() || null;

    // 1. Mise à jour des champs core de l'entreprise
    const { error: coreError } = await supabase
      .from("companies")
      .update({
        name,
        enterprise_number: form.enterprise_number.trim() || null,
        vat_number: form.vat_number.trim() || null,
        country_code: form.country_code.trim().toUpperCase() || "BE",
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        website: form.website.trim() || null,
        iban: form.iban.trim() || null,
        bic: form.bic.trim() || null,
        legal_mentions: form.legal_mentions.trim() || null,
        logo_url: form.logo_url.trim() || null,
      })
      .eq("id", company.id);

    if (coreError) {
      setError(coreError.message);
      setSaving(false);
      return;
    }

    // 2. Upsert des paramètres PDF / défauts dans company_settings
    const { error: settingsError } = await supabase.from("company_settings").upsert(
      {
        company_id: company.id,
        pdf_theme: form.pdf_theme,
        pdf_accent_color: form.pdf_accent_color || null,
        pdf_color_mode: form.pdf_color_mode,
        default_tva_rate: tva_rate,
        default_quote_validity_days: validity_days,
        default_deposit_percent: deposit_percent,
        default_terms: terms,
        default_notes: notes,
      },
      { onConflict: "company_id" }
    );

    if (settingsError) {
      setError(settingsError.message);
      setSaving(false);
      return;
    }

    if (env.administrationEnabled && selectedDesignId) {
      const { error: preferenceError } = await supabase
        .from("company_quote_preferences")
        .update({
          default_design_id: selectedDesignId,
          default_density: form.pdf_density,
        })
        .eq("company_id", company.id);

      if (preferenceError) {
        setError(preferenceError.message);
        setSaving(false);
        return;
      }
    }

    // 3. Mettre à jour l'adresse existante sans la supprimer au préalable.
    // Une suppression suivie d'une insertion pouvait faire perdre l'adresse si
    // la seconde requête échouait.
    const addrLine1 = form.address_line1.trim();
    const addrCity = form.city.trim();
    if (company.address_id || addrLine1 || addrCity) {
      const addressPayload = {
        owner_user_id: currentUser.id,
        entity_type: "company",
        entity_id: company.id,
        role: "main",
        line1: addrLine1 || null,
        line2: form.address_line2.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: addrCity || null,
        country: form.country.trim() || "Belgique",
      };
      const addressResult = company.address_id
        ? await supabase.from("addresses").update(addressPayload).eq("id", company.address_id)
        : await supabase.from("addresses").insert(addressPayload);

      if (addressResult.error) {
        setError(addressResult.error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    await loadSettings();
  }

  async function handleEinvoicingSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!company) return;

    const legalEntityId = einvoicingSetup.legalEntityId.trim();
    const peppolScheme = einvoicingSetup.peppolScheme.trim();
    const peppolIdentifier = einvoicingSetup.peppolIdentifier.trim();
    if (legalEntityId && (!/^\d+$/.test(legalEntityId) || Number(legalEntityId) <= 0)) {
      setError("L’identifiant LegalEntity doit être un nombre positif.");
      return;
    }
    if (Boolean(peppolScheme) !== Boolean(peppolIdentifier)) {
      setError("Le schéma et l’identifiant Peppol doivent être renseignés ensemble.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Utilisateur non connecté.");
      return;
    }

    setSavingEinvoicing(true);
    setEinvoicingMessage(null);
    setError(null);
    const nextStatus = legalEntityId
      ? (einvoicingSetup.connectionStatus === "active" ? "active" : "pending_validation")
      : "not_configured";
    const { error: profileError } = await supabase.from("company_einvoicing_profiles").upsert({
      company_id: company.id,
      environment: "sandbox",
      connection_status: nextStatus,
      storecove_legal_entity_id: legalEntityId ? Number(legalEntityId) : null,
      storecove_tenant_id: einvoicingSetup.tenantId.trim() || null,
      peppol_scheme: peppolScheme || null,
      peppol_identifier: peppolIdentifier || null,
      acts_as_sender: true,
      acts_as_receiver: false,
      created_by: user.id,
    });
    if (profileError) {
      setError(profileError.message);
      setSavingEinvoicing(false);
      return;
    }

    setEinvoicingSetup((current) => ({ ...current, connectionStatus: nextStatus }));
    setEinvoicingMessage("Configuration sandbox enregistrée. La validation réelle restera bloquée tant que la clé API n’est pas installée.");
    setSavingEinvoicing(false);
  }

  // ── Loading / empty states ────────────────────────────────────────────────

  if (loading) {
    return <LoadingBlock message="Chargement des paramètres..." />;
  }

  if (!company) {
    return (
      <section className="settings-premium-page">
        <header className="settings-premium-page__hero">
          <div className="settings-premium-page__hero-main">
            <p className="settings-premium-page__eyebrow">Configuration</p>
            <h1 className="settings-premium-page__title">Paramètres entreprise</h1>
            <p className="settings-premium-page__description">
              Crée d'abord ton entreprise pour centraliser tes coordonnées,
              tes réglages PDF et les valeurs par défaut de tes devis.
            </p>
          </div>
          <div className="settings-premium-page__hero-actions">
            <Button onClick={handleCreateCompany} disabled={creatingCompany}>
              {creatingCompany ? "Création..." : "Créer mon entreprise"}
            </Button>
          </div>
        </header>
        {error && <ErrorMessage message={error} />}
      </section>
    );
  }

  // ── Tab nav (injected into Topbar via portal) ─────────────────────────────

  const tabNav = (
    <nav className="quote-topbar-nav" aria-label="Pages des paramètres">
      {settingsPages.map((page) => (
        <Button
          key={page.id}
          type="button"
          variant={activePage === page.id ? "primary" : "secondary"}
          className={`quote-topbar-nav__tab ${
            activePage === page.id ? "quote-topbar-nav__tab--active" : ""
          }`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </Button>
      ))}
    </nav>
  );

  const tabNavMobile = (
    <div className="quote-page-tabs-mobile" aria-label="Pages des paramètres">
      {settingsPages.map((page) => (
        <Button
          key={page.id}
          type="button"
          variant={activePage === page.id ? "primary" : "secondary"}
          className={`quote-topbar-nav__tab ${
            activePage === page.id ? "quote-topbar-nav__tab--active" : ""
          }`}
          onClick={() => setActivePage(page.id)}
        >
          {page.label}
        </Button>
      ))}
    </div>
  );

  // ── Shared logo uploader ──────────────────────────────────────────────────

  const logoUploaderBlock = (
    <div className="settings-premium-page__logo-uploader">
      {form.logo_url && (
        <div className="settings-premium-page__logo-preview">
          <img
            src={form.logo_url}
            alt="Logo entreprise"
            className="settings-premium-page__logo-img"
          />
          <button
            type="button"
            className="settings-premium-page__logo-remove"
            onClick={handleLogoRemove}
            aria-label="Supprimer le logo"
          >
            &times;
          </button>
        </div>
      )}
      <label
        className={`settings-premium-page__logo-drop ${
          uploadingLogo ? "settings-premium-page__logo-drop--loading" : ""
        }`}
      >
        <input
          type="file"
          accept="image/*"
          className="settings-premium-page__logo-input"
          disabled={uploadingLogo}
          onChange={handleLogoUpload}
        />
        {uploadingLogo ? (
          <span>Envoi en cours...</span>
        ) : (
          <span>
            {form.logo_url ? "Remplacer le logo" : "Cliquer ou glisser une image"}
            <em>PNG, JPG, SVG, WEBP — tous formats acceptés</em>
          </span>
        )}
      </label>
      {logoUploadError && (
        <p className="settings-premium-page__logo-error">{logoUploadError}</p>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section className="settings-premium-page">
      {topbarPortalTarget ? createPortal(tabNav, topbarPortalTarget) : null}

      <header className="settings-premium-page__hero">
        <div className="settings-premium-page__hero-main">
          <p className="settings-premium-page__eyebrow">Configuration</p>
          <h1 className="settings-premium-page__title">Paramètres entreprise</h1>
        </div>
        <div className="settings-premium-page__hero-actions">
          {activePage !== "emails" && (
            <Button variant="secondary" onClick={resetForm}>
              Réinitialiser
            </Button>
          )}
        </div>
      </header>

      {tabNavMobile}

      {/* ══ PAGE : INFORMATIONS ══════════════════════════════════════════════ */}
      {activePage === "informations" && (
        <form className="settings-premium-page__layout" onSubmit={handleSubmit}>
          <div className="settings-premium-page__center">

            {/* Identité */}
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Identité</p>
                  <h2 className="settings-premium-page__section-title">
                    Informations entreprise
                  </h2>
                </div>
              </div>
              <div className="settings-premium-page__form-block">
                <FormGrid columns="2">
                  <FormField label="Nom de l'entreprise">
                    <TextInput
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Numéro de TVA">
                    <TextInput
                      value={form.vat_number}
                      onChange={(e) => updateField("vat_number", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="2">
                  <FormField label="Numéro d’entreprise">
                    <TextInput
                      value={form.enterprise_number}
                      onChange={(e) => updateField("enterprise_number", e.target.value)}
                      placeholder="0123.456.789"
                    />
                  </FormField>
                  <FormField label="Code pays">
                    <TextInput
                      value={form.country_code}
                      onChange={(e) => updateField("country_code", e.target.value)}
                      maxLength={2}
                      placeholder="BE"
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="2">
                  <FormField label="Email">
                    <TextInput
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Téléphone">
                    <TextInput
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="2">
                  <FormField label="Adresse ligne 1">
                    <TextInput
                      value={form.address_line1}
                      onChange={(e) => updateField("address_line1", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Adresse ligne 2">
                    <TextInput
                      value={form.address_line2}
                      onChange={(e) => updateField("address_line2", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="3">
                  <FormField label="Code postal">
                    <TextInput
                      value={form.postal_code}
                      onChange={(e) => updateField("postal_code", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Ville">
                    <TextInput
                      value={form.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Pays">
                    <TextInput
                      value={form.country}
                      onChange={(e) => updateField("country", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
              </div>
            </Card>

            {/* Valeurs par défaut */}
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Commercial</p>
                  <h2 className="settings-premium-page__section-title">
                    Valeurs par défaut des devis
                  </h2>
                </div>
              </div>
              <div className="settings-premium-page__form-block">
                <FormGrid columns="3">
                  <FormField label="TVA par défaut (%)">
                    <TextInput
                      type="number"
                      step="0.01"
                      value={form.default_tva_rate}
                      onChange={(e) => updateField("default_tva_rate", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Validité devis (jours)">
                    <TextInput
                      type="number"
                      value={form.default_quote_validity_days}
                      onChange={(e) => updateField("default_quote_validity_days", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormField label="Notes par défaut">
                  <TextArea
                    rows={4}
                    value={form.default_notes}
                    onChange={(e) => updateField("default_notes", e.target.value)}
                  />
                </FormField>
                <FormField label="Conditions par défaut">
                  <TextArea
                    rows={5}
                    value={form.default_terms}
                    onChange={(e) => updateField("default_terms", e.target.value)}
                  />
                </FormField>
              </div>
            </Card>

            {/* Légal */}
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Légal</p>
                  <h2 className="settings-premium-page__section-title">
                    Coordonnées bancaires &amp; mentions
                  </h2>
                </div>
              </div>
              <div className="settings-premium-page__form-block">
                <FormGrid columns="2">
                  <FormField label="Website">
                    <TextInput
                      value={form.website}
                      onChange={(e) => updateField("website", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="2">
                  <FormField label="IBAN">
                    <TextInput
                      value={form.iban}
                      onChange={(e) => updateField("iban", e.target.value)}
                    />
                  </FormField>
                  <FormField label="BIC">
                    <TextInput
                      value={form.bic}
                      onChange={(e) => updateField("bic", e.target.value)}
                    />
                  </FormField>
                </FormGrid>
                <FormField label="Mentions légales">
                  <TextArea
                    rows={5}
                    value={form.legal_mentions}
                    onChange={(e) => updateField("legal_mentions", e.target.value)}
                  />
                </FormField>
              </div>
            </Card>

            {error && <ErrorMessage message={error} />}

            <div className="settings-premium-page__form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="settings-premium-page__right">
            <Card>
              <div className="settings-premium-page__side-card">
                <p className="settings-premium-page__side-label">Résumé</p>
                <ul className="settings-premium-page__meta-list">
                  <li>
                    <span>Entreprise</span>
                    <strong>{form.name || "-"}</strong>
                  </li>
                  <li>
                    <span>TVA par défaut</span>
                    <strong>{form.default_tva_rate || "21"} %</strong>
                  </li>
                  <li>
                    <span>Validité devis</span>
                    <strong>{form.default_quote_validity_days || "30"} jours</strong>
                  </li>
                  <li>
                    <span>Mise en page PDF</span>
                    <strong>{getPdfThemeLabel(form.pdf_density)}</strong>
                  </li>
                </ul>
              </div>
            </Card>
          </aside>
        </form>
      )}

      {/* ══ PAGE : APPARENCE ═════════════════════════════════════════════════ */}
      {activePage === "apparence" && (
        <form className="settings-premium-page__layout" onSubmit={handleSubmit}>
          <div className="settings-premium-page__center">

            {/* Thème PDF */}
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Document</p>
                  <h2 className="settings-premium-page__section-title">Modèle de devis</h2>
                </div>
              </div>
              <div className="settings-premium-page__form-block">
                <FormField label="Design">
                  <div className="settings-premium-page__theme-picker">
                    {env.administrationEnabled && availableDesigns.length > 0
                      ? availableDesigns.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={`settings-premium-page__theme-card ${
                          selectedDesignId === option.id
                            ? "settings-premium-page__theme-card--active"
                            : ""
                        }`}
                        onClick={() => {
                          setSelectedDesignId(option.id);
                          updateField(
                            "pdf_theme",
                            option.renderer_key === "elegant" ? "elegant" : form.pdf_density,
                          );
                        }}
                      >
                        <span className="settings-premium-page__theme-card-label">
                          {option.name}
                        </span>
                        <span className="settings-premium-page__theme-card-desc">
                          {option.description || "Modèle disponible pour votre entreprise."}
                        </span>
                      </button>
                    ))
                      : PDF_DESIGN_OPTIONS
                        .filter((option) => option.value !== "elegant" || canUseElegantDesign)
                        .map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`settings-premium-page__theme-card ${
                          getPdfDesign(form.pdf_theme) === option.value
                            ? "settings-premium-page__theme-card--active"
                            : ""
                        }`}
                        onClick={() =>
                          updateField(
                            "pdf_theme",
                            option.value === "elegant" ? "elegant" : form.pdf_density,
                          )
                        }
                      >
                        <span className="settings-premium-page__theme-card-label">
                          {option.label}
                        </span>
                        <span className="settings-premium-page__theme-card-desc">
                          {option.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </FormField>

                <FormField label="Densité du contenu">
                  <div className="settings-premium-page__color-mode">
                    {PDF_DENSITY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`settings-premium-page__color-mode-btn${
                          form.pdf_density === option.value
                            ? " settings-premium-page__color-mode-btn--active"
                            : ""
                        }`}
                        onClick={() => {
                          updateField("pdf_density", option.value);
                          if (getPdfDesign(form.pdf_theme) === "standard") updateField("pdf_theme", option.value);
                        }}
                      >
                        <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      </button>
                    ))}
                  </div>
                  <p className="settings-premium-page__field-note">La densité est enregistrée séparément du design visuel.</p>
                </FormField>

                {/* Option couleur */}
                <FormField label="Couleur">
                  <div className="settings-premium-page__color-mode">
                    <button
                      type="button"
                      className={`settings-premium-page__color-mode-btn${
                        form.pdf_color_mode ? " settings-premium-page__color-mode-btn--active" : ""
                      }`}
                      onClick={() => updateField("pdf_color_mode", true)}
                    >
                      <span className="settings-premium-page__color-mode-swatch settings-premium-page__color-mode-swatch--color" />
                      En couleur
                    </button>
                    <button
                      type="button"
                      className={`settings-premium-page__color-mode-btn${
                        !form.pdf_color_mode ? " settings-premium-page__color-mode-btn--active" : ""
                      }`}
                      onClick={() => updateField("pdf_color_mode", false)}
                    >
                      <span className="settings-premium-page__color-mode-swatch settings-premium-page__color-mode-swatch--bw" />
                      Noir &amp; blanc
                    </button>
                  </div>
                </FormField>

                {/* Couleur accent */}
                <FormField label="Couleur d'accent">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <input
                      type="color"
                      value={form.pdf_accent_color || "#8e7452"}
                      onChange={(e) => updateField("pdf_accent_color", e.target.value)}
                      style={{ width: "2.5rem", height: "2.5rem", cursor: "pointer", border: "none", background: "none" }}
                    />
                    <TextInput
                      value={form.pdf_accent_color || "#8e7452"}
                      onChange={(e) => updateField("pdf_accent_color", e.target.value)}
                      placeholder="#8e7452"
                    />
                  </div>
                </FormField>

                {/* Live preview */}
                <div className="settings-premium-page__theme-preview">
                  <p className="settings-premium-page__theme-preview-label">
                    Aperçu — {getPdfDesignLabel(form.pdf_theme)} · {getPdfThemeLabel(form.pdf_density)}{form.pdf_color_mode ? ", en couleur" : ", noir & blanc"}
                  </p>
                  {form.pdf_theme === "compact" ? (
                    <ThemePreviewCompact color={form.pdf_color_mode} />
                  ) : form.pdf_theme === "aere" ? (
                    <ThemePreviewAere color={form.pdf_color_mode} />
                  ) : form.pdf_theme === "elegant" ? (
                    <ThemePreviewElegant color={form.pdf_color_mode} />
                  ) : (
                    <ThemePreviewNormal color={form.pdf_color_mode} />
                  )}
                </div>
              </div>
            </Card>

            {/* Logo */}
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Identité visuelle</p>
                  <h2 className="settings-premium-page__section-title">
                    Logo de l'entreprise
                  </h2>
                </div>
              </div>
              <div className="settings-premium-page__form-block">
                {logoUploaderBlock}
              </div>
            </Card>

            {error && <ErrorMessage message={error} />}

            <div className="settings-premium-page__form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="settings-premium-page__right">
            <Card>
              <div className="settings-premium-page__side-card">
                <p className="settings-premium-page__side-label">Thème actif</p>
                <ul className="settings-premium-page__meta-list">
                  <li>
                    <span>Modèle</span>
                    <strong>{getPdfDesignLabel(form.pdf_theme)}</strong>
                  </li>
                  <li>
                    <span>Densité</span>
                    <strong>{getPdfThemeLabel(form.pdf_density)}</strong>
                  </li>
                  <li>
                    <span>Couleur</span>
                    <strong>{form.pdf_color_mode ? "En couleur" : "Noir & blanc"}</strong>
                  </li>
                  <li>
                    <span>Logo</span>
                    <strong>{form.logo_url ? "Configuré ✓" : "Non défini"}</strong>
                  </li>
                </ul>
              </div>
            </Card>
          </aside>
        </form>
      )}

      {/* ══ PAGE : E-MAILS ═══════════════════════════════════════════════════ */}
      {activePage === "emails" && (
        <EmailSettingsPanel
          companyId={company.id}
          companyName={form.name || company.name}
          companyEmail={form.email || company.email}
          companyLogoUrl={form.logo_url || company.logo_url}
        />
      )}

      {activePage === "einvoicing" && (
        <form className="settings-premium-page__layout" onSubmit={handleEinvoicingSubmit}>
          <div className="settings-premium-page__center">
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Storecove sandbox</p>
                  <h2 className="settings-premium-page__section-title">Préparer la connexion</h2>
                </div>
                <span className={`einvoicing-setup-status einvoicing-setup-status--${einvoicingSetup.connectionStatus}`}>
                  {einvoicingSetup.connectionStatus === "active" ? "Active" : einvoicingSetup.connectionStatus === "pending_validation" ? "À valider" : "Non configurée"}
                </span>
              </div>
              <p className="settings-premium-page__einvoicing-intro">
                Vous pouvez déjà compléter les identifiants. La clé API restera exclusivement dans les secrets Supabase et ne sera jamais demandée dans cet écran.
              </p>
              <div className="settings-premium-page__form-block">
                <FormGrid columns="2">
                  <FormField label="LegalEntity ID Storecove">
                    <TextInput
                      inputMode="numeric"
                      value={einvoicingSetup.legalEntityId}
                      onChange={(event) => setEinvoicingSetup((current) => ({ ...current, legalEntityId: event.target.value }))}
                      placeholder="Disponible après création du sender"
                    />
                  </FormField>
                  <FormField label="Tenant ID (facultatif)">
                    <TextInput
                      value={einvoicingSetup.tenantId}
                      onChange={(event) => setEinvoicingSetup((current) => ({ ...current, tenantId: event.target.value }))}
                    />
                  </FormField>
                </FormGrid>
                <FormGrid columns="2">
                  <FormField label="Schéma Peppol de l’entreprise">
                    <TextInput
                      value={einvoicingSetup.peppolScheme}
                      onChange={(event) => setEinvoicingSetup((current) => ({ ...current, peppolScheme: event.target.value }))}
                      placeholder="BE:EN"
                    />
                  </FormField>
                  <FormField label="Identifiant Peppol">
                    <TextInput
                      value={einvoicingSetup.peppolIdentifier}
                      onChange={(event) => setEinvoicingSetup((current) => ({ ...current, peppolIdentifier: event.target.value }))}
                      placeholder="0123456789"
                    />
                  </FormField>
                </FormGrid>
                {einvoicingMessage ? <p className="settings-premium-page__success-message">{einvoicingMessage}</p> : null}
                {error ? <ErrorMessage message={error} /> : null}
                <Button type="submit" disabled={savingEinvoicing}>{savingEinvoicing ? "Enregistrement…" : "Enregistrer la préparation sandbox"}</Button>
              </div>
            </Card>
            <Card>
              <div className="settings-premium-page__section-header">
                <div>
                  <p className="settings-premium-page__section-eyebrow">Activation</p>
                  <h2 className="settings-premium-page__section-title">Ce qu’il restera à faire</h2>
                </div>
              </div>
              <ol className="settings-premium-page__einvoicing-steps">
                <li>Créer le compte développeur sandbox Storecove et la LegalEntity.</li>
                <li>Installer la clé dans le secret serveur <code>STORECOVE_SANDBOX_API_KEY</code>.</li>
                <li>Valider un premier destinataire de test et configurer le webhook de statuts.</li>
              </ol>
            </Card>
          </div>
        </form>
      )}

      {activePage === "abonnement" && (
        <SubscriptionPanel companyId={company.id} />
      )}
    </section>
  );
}
