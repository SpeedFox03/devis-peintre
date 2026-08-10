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

// Cette migration historique purge uniquement les compteurs techniques de
// limitation vocale vieux de plus de 31 jours. Son contenu exact a été audité.
// Toute modification changera l'empreinte et réactivera automatiquement le blocage.
const approvedLegacyMigrationHashes = new Map([
  [
    "20260807_add_quote_voice_draft_application.sql",
    "b4697b191c78e061046d0f46deb438587fa6d35cf252ee51d40f5cd6ffbd72f2",
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

  if (approvedLegacyMigrationHashes.get(file) === hash) continue;

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
