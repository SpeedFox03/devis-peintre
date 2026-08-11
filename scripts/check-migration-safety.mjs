import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const migrationsDirectory = path.resolve("supabase", "migrations");

const forbiddenPatterns = [
  { label: "DROP TABLE", pattern: /\bdrop\s+table\b/i },
  { label: "DROP COLUMN", pattern: /\bdrop\s+column\b/i },
  { label: "TRUNCATE", pattern: /\btruncate\b/i },
  { label: "DELETE FROM", pattern: /\bdelete\s+from\b/i },
];

// Exceptions destructives explicitement auditées. Toute modification d'un de
// ces fichiers change son empreinte et réactive automatiquement le blocage.
const approvedMigrationHashes = new Map([
  [
    "20260807_add_quote_voice_draft_application.sql",
    "b4697b191c78e061046d0f46deb438587fa6d35cf252ee51d40f5cd6ffbd72f2",
  ],
  [
    "20260811140000_remove_legacy_invoice_domain.sql",
    "947e3fd02b85992569832e1a3c3fd933581ba7cb268572e9712b4a5f992d5dbc",
  ],
]);

const files = (await readdir(migrationsDirectory))
  .filter((file) => file.endsWith(".sql"))
  .sort();

const violations = [];

for (const file of files) {
  const filePath = path.join(migrationsDirectory, file);
  const sql = await readFile(filePath, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");

  if (approvedMigrationHashes.get(file) === hash) continue;

  for (const { label, pattern } of forbiddenPatterns) {
    if (pattern.test(sql)) violations.push(`${file}: ${label}`);
  }
}

if (violations.length > 0) {
  console.error("Migration bloquée : instruction potentiellement destructive détectée.");
  for (const violation of violations) console.error(`- ${violation}`);
  console.error(
    "Les données de production, notamment celles de contact@momentdart.be, doivent rester intactes.",
  );
  process.exit(1);
}

console.log(
  `Sécurité migrations : ${files.length} fichier(s) contrôlé(s), aucune instruction destructive détectée.`,
);
