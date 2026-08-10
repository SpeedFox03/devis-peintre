# Architecture de la refonte

## Parcours produit

La navigation principale suit désormais le travail réel de l’artisan :

1. Dashboard : ce qui demande une action aujourd’hui ;
2. Clients : actifs et archivés dans une seule page ;
3. Projets : dossier du chantier, adresse, état et devis associés ;
4. Devis : création rapide, édition détaillée et historique ;
5. Catalogue : prestations réutilisables ;
6. Paramètres : entreprise, apparence, e-mails et abonnement.

Sur desktop, ces entrées sont dans la sidebar. Sur mobile, les quatre actions principales sont dans une barre basse et les entrées secondaires dans « Plus ».

## E-mails personnalisés par entreprise

Chaque entreprise relie son propre compte Resend depuis les paramètres. Les secrets restent dans Supabase Vault. L'objet, les textes, le bouton, la signature, le logo et les couleurs de l'e-mail de devis sont enregistrés par entreprise et appliqués aussi bien aux envois clients qu'à l'e-mail de test.

## Simplification de l’interface

- une action principale visible par page ;
- création dans des drawers pour conserver le contexte ;
- actions secondaires regroupées dans des menus contextuels ;
- tableaux desktop remplacés par des cartes tactiles sur mobile ;
- dashboard limité aux devis récents, tâches et raccourcis utiles ;
- états vides actionnables et messages de chargement/erreur cohérents ;
- composants communs pour boutons, cartes, champs, tableaux, drawers et menus d’actions.

## Facturation historique

Les routes et composants frontend de facturation ainsi que le code des fonctions Edge Peppol ont été retirés. Le statut historique `invoiced` reste affichable et verrouillé afin de ne pas réécrire les anciens devis. Les tables, paiements, événements Peppol déjà enregistrés et routines SQL nécessaires à leur intégrité ne sont pas supprimés pendant cette migration.

## Modèle de données cible

`auth.users → profiles → company_members → companies → données métier`

Les tables métier reçoivent progressivement un `company_id`. Des backfills et triggers de compatibilité empêchent la création de nouvelles lignes orphelines pendant la transition.

Les ajouts principaux sont :

- `projects` et `project_photos` ;
- `platform_admins` et `company_members` ;
- `quote_designs`, `company_quote_designs` et `company_quote_preferences` ;
- `subscription_plans`, `plan_prices`, `subscriptions` et `billing_events` ;
- `promo_codes`, restrictions par prix et utilisations par entreprise ;
- `admin_audit_log`.

Le design visuel et la densité (`compact`, `normal`, `aere`) sont stockés séparément. Le modèle Élégant est privé et assigné uniquement aux entreprises appartenant à `contact@momentdart.be` lors du backfill.

## Sécurité administration

Le frontend ne suffit jamais à autoriser une action. L’accès est vérifié par `platform_admins`, les politiques RLS et deux fonctions Edge :

- `admin-console-data` pour les vues comptes, abonnements, modèles et promotions ;
- `admin-console-action` pour les mutations avec journal d’audit.

Ces fonctions utilisent la clé de service uniquement après validation du JWT et du rôle administrateur côté serveur.

## Ordre d’activation en production

1. produire l’inventaire protégé et copier la base ainsi que Storage ;
2. restaurer la sauvegarde dans un environnement isolé ;
3. exécuter et vérifier la migration sur cette restauration ;
4. comparer l’inventaire avant/après, en particulier `contact@momentdart.be` ;
5. appliquer la migration additive en production ;
6. déployer les fonctions Edge d’administration ;
7. faire un test de lecture/écriture avec un compte non administrateur puis l’administrateur ;
8. activer les variables frontend et redéployer l’application ;
9. refaire immédiatement l’inventaire protégé.

Au moindre écart de comptes, identifiants, totaux ou fichiers, l’activation s’arrête avant le déploiement frontend.
