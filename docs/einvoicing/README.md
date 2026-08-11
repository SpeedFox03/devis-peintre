# Périmètre facturation — schémas

Cinq diagrammes PlantUML couvrant l'émission de facture, de la mise en route
d'une entreprise jusqu'à l'archivage de la preuve. Ils complètent
[`STORECOVE_FOUNDATION.md`](../STORECOVE_FOUNDATION.md), qui décrit le schéma
de données et la frontière de sécurité.

| Fichier | Ce qu'il répond |
|---|---|
| `01-cas-utilisation.puml` | Tout ce qui existe dans le périmètre, et ce qui reste à construire |
| `02-emission-nominale.puml` | Qui appelle quoi, dans quel ordre, du clic *Émettre* à l'archivage |
| `03-decision-routage.puml` | Comment un document choisit entre Peppol et le repli e-mail |
| `04-cycle-de-vie.puml` | Les états d'un document et les transitions autorisées |
| `05-mise-en-route.puml` | Ce que le peintre saisit, et le provisionnement Storecove |

Rendu : extension PlantUML de VS Code (`Alt+D`), ou `plantuml docs/einvoicing/*.puml`.

## Les trois invariants

Ils traversent les cinq schémas et ne doivent jamais être contournés.

**Le numéro n'existe qu'à l'émission.** Un brouillon n'a pas de numéro. La
séquence est réservée dans la même transaction que le figement du snapshot,
par entreprise, sans trou. C'est une obligation légale et le premier point
que vérifiera un comptable.

**Après émission, le document est immuable.** Aucune politique RLS d'écriture
ne subsiste. Une erreur ne se corrige que par une note de crédit, qui est
elle-même un document de vente suivant le même cycle.

**Le repli PDF n'est pas un cas d'erreur.** C'est le chemin majoritaire : la
clientèle particulière est exemptée de Peppol. Un destinataire absent du
réseau doit produire un envoi e-mail réussi, pas un échec.

## Ordre d'implémentation

Reprend celui de `STORECOVE_FOUNDATION.md`, avec le schéma correspondant.

| # | Unité | Schéma |
|---|---|---|
| 1 | Appliquer les migrations sur une restauration et vérifier le hors-facturation | — |
| 2 | Profil Storecove sandbox pour une entreprise de test | `05` |
| 3 | `convert_quote_to_draft_document()` — conversion atomique | `02` |
| 4 | `issue_sales_document()` — réservation du numéro et snapshot | `02`, `04` |
| 5 | Lookup destinataire + `customer_einvoicing_profiles` | `03`, `05` |
| 6 | Edge Function d'émission + mapping JSON Storecove + `idempotencyGuid` | `02`, `03` |
| 7 | Webhooks : signature HMAC, déduplication, statuts | `02`, `04` |
| 8 | Archivage XML et preuve, empreinte SHA-256 | `02` |
| 9 | Table de traduction des codes de rejet en français | `03` |
| 10 | Notes de crédit | `04` |
| 11 | Paiements et annulations de paiement | `04` |
| 12 | Exports comptables (CSV journal de ventes, UBL) | `01` |
| 13 | Écrans Factures | `01` |

Les étapes 1 à 8 forment le chemin critique : à leur terme une facture part
réellement sur le réseau. Les étapes 9 à 13 la rendent exploitable au
quotidien.

## Deux pièges à ne pas oublier

**L'enregistrement en réception** (schéma `05`). Si le peintre reçoit déjà ses
factures fournisseurs ailleurs — Odoo, Billit, son comptable — il ne faut
surtout pas l'enregistrer en réception chez Storecove : son routage entrant
serait migré et ses factures fournisseurs cesseraient d'arriver. L'émission
n'exige aucune inscription au SMP, donc elle fonctionne quand même.
`receive_enabled` doit valoir `false` par défaut, jamais un effet de bord de
la création du profil.

**Les codes de rejet** (schéma `03`). Le réseau renvoie des erreurs de
validation du type `BR-CL-01`. Sans table de traduction, le premier rejet
devient un appel téléphonique. Les vingt codes les plus fréquents couvrent
l'essentiel ; le reste tombe dans un message générique avec un contact.
