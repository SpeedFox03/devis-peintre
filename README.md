# Application devis artisan

Application React/Vite reliée à Supabase pour gérer le parcours **Client → Projet → Devis**, le catalogue de prestations et les paramètres d’entreprise.

## Développement local

```bash
npm install
npm run dev
```

Contrôle complet avant livraison :

```bash
npm run verify
```

Ce contrôle exécute le lint, la vérification TypeScript, le contrôle de sûreté des migrations et le build de production.

## E-mails de devis

Chaque entreprise peut relier son propre compte Resend dans **Paramètres → E-mails**. La clé API est stockée dans Supabase Vault et n'est jamais exposée au frontend.

Le même écran permet de personnaliser l'objet, le titre, l'introduction, le bouton, la signature, le logo et les couleurs de l'e-mail. Un aperçu en direct et un envoi de test utilisent le rendu réellement envoyé aux clients.

Variables disponibles dans les textes : `{{company_name}}`, `{{client_name}}`, `{{quote_number}}` et `{{quote_title}}`.

## Activation progressive

Les fonctionnalités qui dépendent de la migration finale sont protégées par des variables :

- `VITE_PROJECTS_ENABLED=true` active les projets et le rattachement des devis ;
- `VITE_ADMINISTRATION_ENABLED=true` active abonnements, modèles assignés et administration ;
- `VITE_SIGNUP_ENABLED=true` réactive l’inscription publique.

Les deux premières variables doivent rester désactivées tant que la migration SQL et les fonctions Edge d’administration ne sont pas déployées et vérifiées.

## Données de production

La facturation a été retirée du frontend. Ses tables et données historiques sont volontairement conservées. Toute opération distante doit suivre [la procédure de protection](docs/PROTECTION_DONNEES_PRODUCTION.md), notamment pour le compte `contact@momentdart.be`.

La migration cible se trouve dans `supabase/migrations/20260809_add_company_projects_billing_admin.sql`. Elle est additive et ne doit être exécutée qu’après restauration testée, inventaire avant migration et copie séparée de Supabase Storage.

Voir aussi [l’architecture de la refonte](docs/REFONTE_APPLICATION.md).
