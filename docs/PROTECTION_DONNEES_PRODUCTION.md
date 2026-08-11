# Protection des données de production

Les données rattachées à `contact@momentdart.be` constituent un périmètre protégé. Une refonte fonctionnelle ne doit jamais entraîner leur suppression ou leur remplacement silencieux.

## Périmètre protégé

- utilisateur Supabase Auth et profil ;
- entreprise, paramètres, adresses, identité visuelle et réglages e-mail ;
- clients et adresses ;
- devis, lignes, pièces, photos, modèles, liens publics, réponses et envois ;
- catalogue et opérations de saisie vocale ;
- fichiers Supabase Storage associés, notamment logos et photos.

L'ancien domaine `invoices*` est explicitement exclu de ce périmètre : il ne
contenait que des données de test d'une fonctionnalité abandonnée. Le nouveau
domaine `sales_documents*` redevient protégé dès sa mise en service.

Le périmètre doit être calculé à partir de l'utilisateur Auth, de son entreprise et de toutes les clés étrangères ou références métier. Un filtrage direct par adresse e-mail ne suffit pas.

## Règles obligatoires

1. Ne jamais lancer `supabase db reset` contre la production.
2. Les migrations initiales sont additives : nouvelles tables, nouvelles colonnes nullable, index et politiques.
3. `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` et `DELETE FROM` sont bloqués par `npm run check:migrations`, hors migration destructive explicitement auditée et verrouillée par empreinte.
4. La seule exception autorisée retire les tables `invoices*` de test après contrôle des dépendances et installation du nouveau domaine.
5. Le statut historique `invoiced` reste stocké et lisible, mais ne peut plus être créé depuis l'application.
6. Aucun changement de propriété ou backfill ne passe en production sans contrôle avant/après.
7. Une sauvegarde de la base et une copie séparée des objets Storage sont requises avant la première migration distante.
8. La restauration doit être testée sur un environnement distinct avant toute migration de production.

## Contrôles avant production

- exécuter `supabase/verification/preflight_schema.sql` sur la restauration pour confirmer le schéma et la signature réelle de `create_quote` ;
- exporter le schéma, Auth, les données métier et les métadonnées Storage ;
- copier physiquement les objets Storage ;
- produire les comptes de lignes par table pour le périmètre protégé ;
- vérifier les relations entre entreprise, clients, devis, pièces et lignes ;
- vérifier le nombre, la taille et l'empreinte des fichiers ;
- exécuter la migration sur une restauration de test ;
- comparer les identifiants, comptes, totaux financiers et fichiers avant/après ;
- interrompre la migration au moindre écart inattendu.

Le fichier `supabase/verification/protected_account_manifest.sql` fournit l'inventaire avant/après du compte protégé. Il doit être conservé avec les artefacts de sauvegarde et les résultats de la restauration testée.

## Réinitialisation de la facturation

L'ancienne facturation et ses fonctions Edge sont des données et du code de
test. La migration dédiée supprime uniquement ses six tables et neuf routines,
sans `CASCADE`. Les devis, clients, catalogues, projets, fichiers et réglages de
Moment d'Art restent protégés et sont comparés avant/après par empreinte.
