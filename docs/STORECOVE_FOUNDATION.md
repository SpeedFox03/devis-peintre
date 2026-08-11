# Fondation Storecove

## Décision de migration

Les tables historiques `invoices`, `invoice_items`, `invoice_payments`,
`invoice_peppol_events`, `invoice_exports` et `invoice_snapshots` ne contenaient
que des données de test d'une fonctionnalité abandonnée. Leur suppression,
ainsi que celle des anciennes routines SQL, a été explicitement autorisée et
est isolée dans `20260811140000_remove_legacy_invoice_domain.sql`.

La restauration locale contrôlée avant cette décision contient 11 factures,
43 lignes, 8 snapshots, aucun paiement et aucun événement Peppol. Deux formats
de numérotation y coexistent et `F-2026-0001` apparaît dans plusieurs périmètres
d'entreprise. Cela justifie une nouvelle séquence atomique par entreprise sans
réutiliser les compteurs historiques.

Le nouveau domaine commence avec :

- `company_einvoicing_profiles` : connexion Storecove/Peppol par entreprise et environnement ;
- `customer_einvoicing_profiles` : identité de routage et découverte Peppol ;
- `sales_documents` et `sales_document_lines` : factures et notes de crédit neuves ;
- `sales_document_sequences` : numérotation atomique par entreprise ;
- `sales_document_payments` : paiements et annulations de paiements ;
- `einvoice_submissions` : tentatives Storecove idempotentes ;
- `einvoice_events` : journal de webhooks dédupliqué ;
- `einvoice_artifacts` : XML, PDF et preuves archivés durablement.

## Frontière de sécurité

La clé API Storecove ne sera jamais accessible au navigateur. Les créations de
soumissions, écritures d'événements et copies de preuves seront réalisées par
des fonctions Edge avec la clé de service après validation du JWT et de
l'appartenance à l'entreprise.

Les membres peuvent préparer des brouillons et leurs lignes. Après émission,
le navigateur n'a plus de politique permettant de modifier le document.
Des clés étrangères composites empêchent aussi de rattacher un document au
client, au devis ou au projet d'une autre entreprise, même via une fonction
serveur disposant du service role.

## État de l'implémentation au 11 août 2026

Déjà appliqué sur le projet Supabase lié :

- nouveau domaine de données et suppression de l'ancien domaine de test ;
- conversion atomique d'un devis accepté en brouillon de facture ;
- émission irréversible avec numéro `FAC-AAAA-NNNN`, snapshots et passage du devis en historique ;
- garde contre la double facture d'un devis et contre les soumissions Storecove concurrentes ;
- pages responsive `/factures` et `/factures/:invoiceId` ;
- génération et contrôle du JSON Storecove V2 ;
- fonctions Edge `invoice-storecove-preview` et `invoice-storecove-submit` déployées ;
- récepteur de webhooks idempotent écrit, mais volontairement non déployé tant que son secret n'est pas configuré.

Le bouton d'envoi réel n'apparaît que si le contrôle préalable est entièrement
vert. En l'absence de clé API et de `LegalEntity`, l'interface explique les
éléments manquants et ne crée aucune fausse transmission.

## Prochaine activation Storecove

1. obtenir un compte développeur sandbox, une clé API et une `LegalEntity` approuvée ;
2. enregistrer la clé dans `STORECOVE_SANDBOX_API_KEY`, jamais dans Vite ou le navigateur ;
3. créer le profil sandbox de l'entreprise avec le `storecove_legal_entity_id` ;
4. créer `STORECOVE_WEBHOOK_SECRET`, le déclarer comme en-tête personnalisé dans Storecove et déployer `storecove-webhook` sans vérification JWT Supabase ;
5. tester avec l'identifiant Storecove belge `BE:EN 0112233453` ;
6. ajouter la découverte automatique des destinataires puis l'archivage de la preuve et du XML.

## Ordre d'implémentation initial

1. appliquer les migrations sur une restauration et vérifier que les données métier hors facturation restent identiques ;
2. créer un profil Storecove sandbox pour une entreprise de test ;
3. créer la fonction atomique de conversion devis vers brouillon de facture ;
4. créer la fonction d'émission qui réserve le numéro et capture les snapshots ;
5. mapper le document vers le JSON Storecove et envoyer avec `idempotencyGuid` ;
6. recevoir les webhooks, les dédupliquer et mettre à jour le statut ;
7. télécharger puis archiver l'XML et la preuve d'envoi ;
8. construire les nouvelles pages Factures.

## Règle d'archivage

Une URL temporaire retournée par Storecove n'est pas une archive. Le document
structuré réellement envoyé et sa preuve doivent être téléchargés, contrôlés
par empreinte SHA-256 et conservés dans Storage avec leur métadonnée.
