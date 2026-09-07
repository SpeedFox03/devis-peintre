begin;

-- Passage au multi-metier.
--
-- Les categories de prestations quittent le code (PAINT_CATEGORIES cote front
-- et CATALOG_CATEGORIES dans l'edge function) pour devenir des donnees, et
-- chaque metier apporte ses propres categories et son catalogue type.
--
-- Regle d'activation : les prestations types sont COPIEES dans le catalogue de
-- l'entreprise, qui en devient proprietaire et peut les modifier librement.
-- Regle de desactivation : rien n'est jamais supprime, seulement masque, et
-- uniquement ce que l'artisan n'a ni modifie ni utilise dans un devis.

-- ---------------------------------------------------------------------------
-- 1. Referentiel
-- ---------------------------------------------------------------------------

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.trades is
  'Metiers du batiment couverts par l''application.';

create table if not exists public.catalog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

comment on table public.catalog_categories is
  'Categories de prestations, partagees entre metiers plutot que dupliquees.';

create table if not exists public.trade_categories (
  trade_id uuid not null references public.trades(id) on delete cascade,
  category_id uuid not null references public.catalog_categories(id) on delete cascade,
  sort_order integer not null default 0,
  primary key (trade_id, category_id)
);

comment on table public.trade_categories is
  'Quelles categories sont proposees pour quel metier. Relation n-n : une meme categorie sert plusieurs metiers.';

create table if not exists public.trade_service_templates (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trades(id) on delete cascade,
  catalog_key text not null,
  name text not null,
  category text not null,
  unit text not null,
  price_low numeric(12, 2) not null check (price_low >= 0),
  price_average numeric(12, 2) not null check (price_average >= 0),
  price_high numeric(12, 2) not null check (price_high >= 0),
  description text,
  aliases text[] not null default '{}',
  pricing_basis text check (
    pricing_basis in ('finished_surface', 'per_coat', 'per_unit')
  ),
  surface_type text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  constraint trade_service_templates_prices_ordered check (
    price_low <= price_average and price_average <= price_high
  ),
  unique (trade_id, catalog_key)
);

comment on table public.trade_service_templates is
  'Catalogue type par metier. Copie dans service_catalog a l''activation, jamais lu ensuite.';

create index if not exists trade_service_templates_trade_idx
  on public.trade_service_templates(trade_id, sort_order);

create table if not exists public.company_trades (
  company_id uuid not null references public.companies(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  activated_at timestamptz not null default now(),
  activated_by uuid references auth.users(id),
  primary key (company_id, trade_id)
);

comment on table public.company_trades is
  'Metiers actives par une entreprise. Un artisan en pratique souvent plusieurs.';

alter table public.service_catalog
  add column if not exists trade_id uuid references public.trades(id);

create index if not exists service_catalog_trade_idx
  on public.service_catalog(company_id, trade_id, is_active);

-- ---------------------------------------------------------------------------
-- 2. Acces
-- ---------------------------------------------------------------------------

-- Referentiel : lisible par tout compte connecte, ecriture reservee au service.
alter table public.trades enable row level security;
alter table public.catalog_categories enable row level security;
alter table public.trade_categories enable row level security;
alter table public.trade_service_templates enable row level security;

drop policy if exists "trades_select_all" on public.trades;
create policy "trades_select_all" on public.trades
  for select to authenticated using (true);

drop policy if exists "catalog_categories_select_all" on public.catalog_categories;
create policy "catalog_categories_select_all" on public.catalog_categories
  for select to authenticated using (true);

drop policy if exists "trade_categories_select_all" on public.trade_categories;
create policy "trade_categories_select_all" on public.trade_categories
  for select to authenticated using (true);

drop policy if exists "trade_service_templates_select_all" on public.trade_service_templates;
create policy "trade_service_templates_select_all" on public.trade_service_templates
  for select to authenticated using (true);

revoke all on table public.trades from public, anon;
revoke all on table public.catalog_categories from public, anon;
revoke all on table public.trade_categories from public, anon;
revoke all on table public.trade_service_templates from public, anon;
grant select on table public.trades to authenticated;
grant select on table public.catalog_categories to authenticated;
grant select on table public.trade_categories to authenticated;
grant select on table public.trade_service_templates to authenticated;

-- Metiers actives : cloisonnes par entreprise.
alter table public.company_trades enable row level security;

drop policy if exists "company_trades_select_own" on public.company_trades;
create policy "company_trades_select_own" on public.company_trades
  for select to authenticated
  using (public.is_company_member(company_id));

revoke all on table public.company_trades from public, anon;
grant select on table public.company_trades to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Metiers
-- ---------------------------------------------------------------------------

insert into public.trades (slug, name, description, sort_order)
values
  ('peintre', 'Peintre en batiment', 'Preparation des supports, mise en peinture interieure et exterieure, boiseries et ferronneries.', 10),
  ('plafonneur', 'Plafonneur et plaquiste', 'Plafonnage traditionnel, cloisons seches, faux plafonds, bandes et enduits de finition.', 20),
  ('carreleur', 'Carreleur', 'Preparation des sols, etancheite, pose de carrelage et de faience, joints et finitions.', 30),
  ('solier', 'Poseur de revetements de sol', 'Ragreage, parquet, vinyle, linoleum et moquette, plinthes et barres de seuil.', 40),
  ('facadier', 'Facadier', 'Nettoyage et traitement de facade, enduits exterieurs, isolation par l''exterieur.', 50)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 4. Categories
-- ---------------------------------------------------------------------------

insert into public.catalog_categories (slug, label, sort_order)
values
  -- Transverses
  ('protection_chantier', 'Protection chantier', 10),
  ('depose_evacuation', 'Depose et evacuation', 20),
  ('preparation_support', 'Preparation support', 30),
  ('nettoyage_fin_chantier', 'Nettoyage fin de chantier', 900),
  ('other', 'Autre', 999),
  -- Peinture
  ('lessivage', 'Lessivage', 40),
  ('grattage', 'Grattage', 50),
  ('rebouchage', 'Rebouchage', 60),
  ('enduit', 'Enduit', 70),
  ('poncage', 'Poncage', 80),
  ('impression', 'Impression', 90),
  ('peinture_mur', 'Peinture mur', 100),
  ('peinture_plafond', 'Peinture plafond', 110),
  ('boiseries', 'Boiseries', 120),
  ('portes', 'Portes', 130),
  ('plinthes', 'Plinthes', 140),
  ('radiateurs', 'Radiateurs', 150),
  ('ferronneries', 'Ferronneries', 160),
  ('facade', 'Facade', 170),
  -- Plafonnage et plaquisterie
  ('plafonnage', 'Plafonnage', 200),
  ('cloison_seche', 'Cloisons seches', 210),
  ('faux_plafond', 'Faux plafonds', 220),
  ('bandes_joints', 'Bandes et joints', 230),
  ('isolation', 'Isolation', 240),
  ('profiles_finition', 'Profiles et finitions', 250),
  -- Carrelage
  ('chape_ragreage', 'Chape et ragreage', 300),
  ('etancheite', 'Etancheite', 310),
  ('carrelage_sol', 'Carrelage sol', 320),
  ('carrelage_mur', 'Faience et carrelage mural', 330),
  ('joints_carrelage', 'Joints de carrelage', 340),
  -- Revetements de sol
  ('sous_couche_sol', 'Sous-couches et preparation sol', 400),
  ('parquet', 'Parquet', 410),
  ('sol_souple', 'Sols souples', 420),
  ('moquette', 'Moquette', 430),
  -- Facade
  ('echafaudage', 'Echafaudage et acces', 500),
  ('nettoyage_facade', 'Nettoyage de facade', 510),
  ('enduit_facade', 'Enduit de facade', 520),
  ('isolation_exterieure', 'Isolation par l''exterieur', 530),
  ('traitement_facade', 'Traitement et protection facade', 540)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 5. Categories par metier
-- ---------------------------------------------------------------------------

insert into public.trade_categories (trade_id, category_id, sort_order)
select trade.id, category.id, category.sort_order
from public.trades trade
join lateral (
  select unnest(
    case trade.slug
      when 'peintre' then array[
        'preparation_support', 'protection_chantier', 'lessivage', 'grattage',
        'rebouchage', 'enduit', 'poncage', 'impression', 'peinture_mur',
        'peinture_plafond', 'boiseries', 'portes', 'plinthes', 'radiateurs',
        'ferronneries', 'facade', 'nettoyage_fin_chantier', 'other'
      ]
      when 'plafonneur' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support',
        'plafonnage', 'cloison_seche', 'faux_plafond', 'bandes_joints',
        'isolation', 'enduit', 'poncage', 'profiles_finition',
        'nettoyage_fin_chantier', 'other'
      ]
      when 'carreleur' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support',
        'chape_ragreage', 'etancheite', 'carrelage_sol', 'carrelage_mur',
        'joints_carrelage', 'plinthes', 'profiles_finition',
        'nettoyage_fin_chantier', 'other'
      ]
      when 'solier' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support',
        'chape_ragreage', 'sous_couche_sol', 'parquet', 'sol_souple',
        'moquette', 'plinthes', 'profiles_finition',
        'nettoyage_fin_chantier', 'other'
      ]
      when 'facadier' then array[
        'protection_chantier', 'echafaudage', 'nettoyage_facade',
        'preparation_support', 'rebouchage', 'enduit_facade',
        'isolation_exterieure', 'traitement_facade', 'facade',
        'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      else array[]::text[]
    end
  ) as slug
) as wanted on true
join public.catalog_categories category on category.slug = wanted.slug
on conflict (trade_id, category_id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. Catalogues types
-- ---------------------------------------------------------------------------
--
-- Prix HT indicatifs, marche belge, aout 2026. Ils servent de point de depart :
-- l'artisan les ajuste apres copie. Les trois paliers correspondent a petit
-- prix, prix moyen et gros prix.
--
-- Les cles du metier peintre reprennent a l'identique celles de
-- seed_default_service_catalog : les catalogues deja crees restent reconnus et
-- les liaisons fournisseurs existantes continuent de pointer dessus.

insert into public.trade_service_templates (
  trade_id, catalog_key, name, category, unit,
  price_low, price_average, price_high, description,
  aliases, pricing_basis, surface_type, sort_order
)
select
  trade.id, seed.catalog_key, seed.name, seed.category, seed.unit,
  seed.price_low, seed.price_average, seed.price_high, seed.description,
  seed.aliases, seed.pricing_basis, seed.surface_type, seed.sort_order
from (
  values
    -- ---------------------------------------------------------------- PEINTRE
    ('peintre', 'protection_sols_mobilier', 'Protection des sols et du mobilier', 'protection_chantier', 'm2', 2.50, 3.50, 5.00, 'Mise en place de baches, films de protection et adhesifs. Comprend la pose et le retrait des protections.', array[]::text[], null::text, null::text, 10),
    ('peintre', 'protection_complete_piece', 'Protection complète d''une pièce', 'protection_chantier', 'forfait', 75.00, 110.00, 160.00, 'Protection complète des sols, meubles, portes, fenêtres, prises et éléments fixes avant intervention.', array[]::text[], null, null, 20),
    ('peintre', 'preparation_legere_support', 'Préparation légère du support', 'preparation_support', 'm2', 6.00, 9.00, 13.00, 'Dépoussiérage, contrôle du support, petites reprises ponctuelles et préparation avant mise en peinture.', array[]::text[], null, null, 30),
    ('peintre', 'lessivage_murs_plafonds', 'Lessivage murs et plafonds', 'lessivage', 'm2', 3.50, 5.00, 7.50, 'Nettoyage du support afin d''eliminer les poussieres, salissures legeres et residus avant peinture.', array[]::text[], null, null, 40),
    ('peintre', 'degraissage_intensif_support', 'Dégraissage intensif du support', 'lessivage', 'm2', 5.00, 7.50, 11.00, 'Nettoyage approfondi des surfaces grasses ou fortement encrassées, notamment dans les cuisines.', array[]::text[], null, null, 50),
    ('peintre', 'grattage_peintures_non_adherentes', 'Grattage des peintures non adhérentes', 'grattage', 'm2', 5.00, 8.00, 12.00, 'Élimination des parties de peinture écaillées, cloquées ou non adhérentes avant réparation.', array[]::text[], null, null, 60),
    ('peintre', 'depose_papier_peint_simple', 'Dépose de papier peint simple', 'grattage', 'm2', 8.00, 12.00, 18.00, 'Retrait d''un papier peint standard, hors réparation importante ou enduisage complet du support.', array[]::text[], null, null, 70),
    ('peintre', 'rebouchage_ponctuel_defauts', 'Rebouchage ponctuel des défauts', 'rebouchage', 'm2', 5.00, 8.00, 12.00, 'Rebouchage localisé des trous de fixation, petits impacts et défauts superficiels.', array[]::text[], null, null, 80),
    ('peintre', 'traitement_rebouchage_fissures', 'Traitement et rebouchage de fissures', 'rebouchage', 'ml', 7.00, 11.00, 16.00, 'Ouverture, nettoyage et rebouchage des fissures non structurelles avant ponçage et finition.', array[]::text[], null, null, 90),
    ('peintre', 'enduit_local_reparation', 'Enduit local de réparation', 'enduit', 'm2', 10.00, 15.00, 22.00, 'Application localisée d''un enduit afin de corriger les défauts et remettre le support à niveau.', array[]::text[], null, null, 100),
    ('peintre', 'enduisage_complet_support', 'Enduisage complet du support', 'enduit', 'm2', 18.00, 25.00, 35.00, 'Application d''un enduit généralisé pour obtenir une surface uniforme avant mise en peinture.', array[]::text[], null, null, 110),
    ('peintre', 'enduit_decoratif_chaux', 'Enduit décoratif à la chaux', 'enduit', 'm2', 45.00, 65.00, 90.00, 'Application manuelle d''un enduit décoratif minéral avec effets et nuances selon la finition choisie.', array[]::text[], null, null, 120),
    ('peintre', 'poncage_leger_support', 'Ponçage léger du support', 'poncage', 'm2', 3.00, 5.00, 7.00, 'Ponçage léger destiné à matifier et régulariser une surface avant l''application de peinture.', array[]::text[], null, null, 130),
    ('peintre', 'poncage_mecanique_complet', 'Ponçage mécanique complet', 'poncage', 'm2', 7.00, 10.00, 15.00, 'Ponçage mécanique approfondi avec aspiration afin de corriger les irrégularités du support.', array[]::text[], null, null, 140),
    ('peintre', 'impression_acrylique_standard', 'Impression acrylique standard', 'impression', 'm2', 5.00, 7.00, 10.00, 'Application d''une couche d''impression pour réguler l''absorption et favoriser l''adhérence.', array[]::text[], null, null, 150),
    ('peintre', 'primaire_isolant_anti_taches', 'Primaire isolant anti-taches', 'impression', 'm2', 9.00, 13.00, 18.00, 'Application d''un primaire isolant sur les taches de nicotine, suie ou anciennes aureoles seches.', array[]::text[], null, null, 160),
    ('peintre', 'peinture_murs_acrylique_2_couches', 'Peinture murs acrylique 2 couches', 'peinture_mur', 'm2', 15.00, 20.00, 28.00, 'Application de deux couches de peinture acrylique professionnelle sur un support prepare.', array[]::text[], null, null, 170),
    ('peintre', 'peinture_murs_lessivable_satinee_2_couches', 'Peinture murs lessivable satinée 2 couches', 'peinture_mur', 'm2', 17.00, 23.00, 32.00, 'Application de deux couches de peinture résistante et lessivable adaptée aux zones sollicitées.', array[]::text[], null, null, 180),
    ('peintre', 'peinture_murs_teinte_foncee_2_couches', 'Peinture murs teinte foncée 2 couches', 'peinture_mur', 'm2', 19.00, 26.00, 36.00, 'Application de deux couches dans une teinte soutenue nécessitant une mise en œuvre précise.', array[]::text[], null, null, 190),
    ('peintre', 'peinture_plafond_mate_2_couches', 'Peinture plafond mate 2 couches', 'peinture_plafond', 'm2', 19.00, 25.00, 34.00, 'Application de deux couches de peinture mate professionnelle sur un plafond préparé.', array[]::text[], null, null, 200),
    ('peintre', 'peinture_plafond_piece_humide', 'Peinture plafond pièce humide', 'peinture_plafond', 'm2', 22.00, 29.00, 39.00, 'Application de deux couches de peinture adaptée aux salles de bain, cuisines et pièces humides.', array[]::text[], null, null, 210),
    ('peintre', 'peinture_boiseries_interieures', 'Peinture boiseries intérieures', 'boiseries', 'm2', 30.00, 42.00, 58.00, 'Préparation légère, sous-couche adaptée et application de deux couches de finition sur bois.', array[]::text[], null, null, 220),
    ('peintre', 'peinture_chassis_interieur', 'Peinture châssis intérieur', 'boiseries', 'qty', 95.00, 140.00, 210.00, 'Préparation et peinture de la face intérieure d''un châssis de dimensions standard.', array[]::text[], null, null, 230),
    ('peintre', 'peinture_porte_plane_une_face', 'Peinture porte plane une face', 'portes', 'qty', 65.00, 95.00, 145.00, 'Preparation legere et application de deux couches de peinture sur une face de porte plane.', array[]::text[], null, null, 240),
    ('peintre', 'peinture_porte_complete_chambranles', 'Peinture porte complète et chambranles', 'portes', 'qty', 145.00, 210.00, 310.00, 'Préparation et peinture des deux faces, des chants, de l''encadrement et des chambranles.', array[]::text[], null, null, 250),
    ('peintre', 'peinture_plinthes', 'Peinture plinthes', 'plinthes', 'ml', 7.00, 10.00, 15.00, 'Preparation legere et application de deux couches de finition sur les plinthes.', array[]::text[], null, null, 260),
    ('peintre', 'peinture_radiateur_panneau', 'Peinture radiateur panneau', 'radiateurs', 'qty', 85.00, 125.00, 185.00, 'Nettoyage, preparation et application d''une peinture adaptee sur un radiateur panneau standard.', array[]::text[], null, null, 270),
    ('peintre', 'peinture_radiateur_fonte_tubulaire', 'Peinture radiateur fonte ou tubulaire', 'radiateurs', 'qty', 160.00, 240.00, 360.00, 'Preparation et peinture d''un radiateur complexe comportant plusieurs colonnes ou elements.', array[]::text[], null, null, 280),
    ('peintre', 'peinture_garde_corps_barriere_metallique', 'Peinture garde-corps ou barrière métallique', 'ferronneries', 'ml', 25.00, 38.00, 55.00, 'Préparation, traitement des points de corrosion et peinture d''une structure métallique linéaire.', array[]::text[], null, null, 290),
    ('peintre', 'preparation_peinture_ferronnerie', 'Préparation et peinture de ferronnerie', 'ferronneries', 'm2', 32.00, 46.00, 65.00, 'Nettoyage, ponçage, primaire antirouille et application de deux couches de finition sur métal.', array[]::text[], null, null, 300),
    ('peintre', 'nettoyage_facade_avant_peinture', 'Nettoyage de façade avant peinture', 'facade', 'm2', 6.00, 9.00, 14.00, 'Nettoyage de la façade et élimination des salissures superficielles avant préparation et peinture.', array[]::text[], null, null, 310),
    ('peintre', 'reparation_fissures_facade', 'Réparation de fissures de façade', 'facade', 'ml', 10.00, 15.00, 24.00, 'Ouverture, nettoyage et réparation des fissures non structurelles présentes sur une façade.', array[]::text[], null, null, 320),
    ('peintre', 'primaire_facade', 'Primaire pour façade', 'facade', 'm2', 7.00, 10.00, 15.00, 'Application d''un primaire extérieur adapté à la porosité et à la nature du support.', array[]::text[], null, null, 330),
    ('peintre', 'peinture_facade_2_couches', 'Peinture de façade 2 couches', 'facade', 'm2', 23.00, 32.00, 45.00, 'Application de deux couches de peinture extérieure professionnelle sur une façade préparée.', array[]::text[], null, null, 340),
    ('peintre', 'nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Retrait des protections, evacuation des dechets legers, aspiration et nettoyage de la zone.', array[]::text[], null, null, 350),
    ('peintre', 'main_oeuvre_peintre', 'Main-d''œuvre peintre', 'other', 'h', 38.00, 48.00, 58.00, 'Intervention facturée à l''heure pour les travaux particuliers ne pouvant pas être calculés au m².', array[]::text[], null, null, 360),
    ('peintre', 'journee_travail_peintre', 'Journée de travail peintre', 'other', 'jour', 304.00, 384.00, 464.00, 'Mise à disposition d''un peintre durant une journée de huit heures, hors fournitures spéciales.', array[]::text[], null, null, 370),
    ('peintre', 'minimum_intervention', 'Minimum d''intervention', 'other', 'forfait', 160.00, 240.00, 350.00, 'Montant minimum applicable aux petits travaux afin de couvrir le deplacement et l''installation.', array[]::text[], null, null, 380),
    ('peintre', 'echantillon_couleur_support', 'Échantillon de couleur sur support', 'other', 'qty', 20.00, 35.00, 55.00, 'Réalisation d''un échantillon de couleur directement sur le support avant validation définitive.', array[]::text[], null, null, 390),
    ('peintre', 'fourniture_peinture_speciale', 'Fourniture de peinture spéciale', 'other', 'litre', 18.00, 28.00, 45.00, 'Fourniture d''une peinture technique, décorative ou spécifique non comprise dans le tarif standard.', array[]::text[], null, null, 400),

    -- ------------------------------------------------------------- PLAFONNEUR
    ('plafonneur', 'plaf_protection_chantier', 'Protection du chantier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Bâchage des sols, protection des menuiseries et des éléments fixes avant intervention.', array['protection', 'bâchage'], 'finished_surface', null, 10),
    ('plafonneur', 'plaf_depose_ancien_plafonnage', 'Dépose d''ancien plafonnage', 'depose_evacuation', 'm2', 12.00, 18.00, 26.00, 'Piquage et retrait d''un enduit ou plafonnage existant jusqu''au support sain.', array['piquage', 'dépose plafonnage'], 'finished_surface', null, 20),
    ('plafonneur', 'plaf_depose_cloison', 'Dépose de cloison existante', 'depose_evacuation', 'm2', 15.00, 22.00, 32.00, 'Démontage d''une cloison légère, y compris ossature et parements.', array['démolition cloison'], 'finished_surface', null, 30),
    ('plafonneur', 'plaf_evacuation_gravats', 'Évacuation des gravats', 'depose_evacuation', 'forfait', 120.00, 200.00, 320.00, 'Chargement, transport et mise en décharge agréée des déchets de chantier.', array['évacuation', 'gravats', 'déchets'], 'per_unit', null, 40),
    ('plafonneur', 'plaf_primaire_accrochage', 'Primaire d''accrochage', 'preparation_support', 'm2', 3.00, 5.00, 7.50, 'Application d''un primaire adapté à la porosité du support avant plafonnage.', array['primaire', 'accrochage'], 'finished_surface', null, 50),
    ('plafonneur', 'plaf_mur_maconnerie', 'Plafonnage de murs sur maçonnerie', 'plafonnage', 'm2', 18.00, 24.00, 32.00, 'Application manuelle ou projetée d''un enduit de plâtre sur maçonnerie, dressé et lissé.', array['plafonnage mur', 'enduit mur', 'plâtrage'], 'finished_surface', 'wall', 60),
    ('plafonneur', 'plaf_plafond', 'Plafonnage de plafond', 'plafonnage', 'm2', 22.00, 29.00, 38.00, 'Plafonnage d''un plafond, dressage et lissage prêt à peindre.', array['plafonnage plafond', 'enduit plafond'], 'finished_surface', 'ceiling', 70),
    ('plafonneur', 'plaf_rattrapage', 'Rattrapage de plafonnage existant', 'plafonnage', 'm2', 14.00, 20.00, 28.00, 'Reprise localisée d''un plafonnage abîmé afin de retrouver une surface homogène.', array['rattrapage', 'reprise plafonnage'], 'finished_surface', null, 80),
    ('plafonneur', 'plaf_cloison_simple_ossature', 'Cloison sur simple ossature', 'cloison_seche', 'm2', 45.00, 58.00, 75.00, 'Ossature métallique et plaques de plâtre sur une face de chaque côté, hors isolation.', array['cloison', 'gyproc', 'placo'], 'finished_surface', 'wall', 90),
    ('plafonneur', 'plaf_cloison_double_parement', 'Cloison double parement', 'cloison_seche', 'm2', 60.00, 78.00, 98.00, 'Ossature et double plaque de chaque côté pour une meilleure isolation acoustique.', array['double parement', 'cloison acoustique'], 'finished_surface', 'wall', 100),
    ('plafonneur', 'plaf_cloison_hydrofuge', 'Cloison hydrofuge pièce humide', 'cloison_seche', 'm2', 55.00, 70.00, 90.00, 'Cloison avec plaques hydrofuges adaptées aux salles de bain et pièces humides.', array['hydrofuge', 'plaque verte'], 'finished_surface', 'wall', 110),
    ('plafonneur', 'plaf_contre_cloison', 'Contre-cloison de doublage', 'cloison_seche', 'm2', 40.00, 52.00, 68.00, 'Doublage d''un mur existant sur ossature, prêt à recevoir isolation et finition.', array['doublage', 'contre-cloison'], 'finished_surface', 'wall', 120),
    ('plafonneur', 'plaf_faux_plafond_suspendu', 'Faux plafond suspendu', 'faux_plafond', 'm2', 45.00, 60.00, 78.00, 'Ossature suspendue et plaques de plâtre, prêt à enduire.', array['faux plafond', 'plafond suspendu'], 'finished_surface', 'ceiling', 130),
    ('plafonneur', 'plaf_faux_plafond_demontable', 'Faux plafond démontable', 'faux_plafond', 'm2', 38.00, 50.00, 65.00, 'Ossature apparente et dalles démontables, accès aux gaines conservé.', array['dalles', 'plafond démontable'], 'finished_surface', 'ceiling', 140),
    ('plafonneur', 'plaf_trappe_visite', 'Trappe de visite', 'faux_plafond', 'qty', 85.00, 130.00, 190.00, 'Fourniture et pose d''une trappe de visite dans un plafond ou une cloison.', array['trappe'], 'per_unit', null, 150),
    ('plafonneur', 'plaf_bandes_joints', 'Bandes et joints, finition', 'bandes_joints', 'm2', 6.00, 9.00, 13.00, 'Pose des bandes, remplissage des joints et enduit de finition prêt à peindre.', array['bandes', 'jointoyage', 'joints'], 'finished_surface', null, 160),
    ('plafonneur', 'plaf_enduit_lissage', 'Enduit de lissage complet', 'enduit', 'm2', 12.00, 17.00, 24.00, 'Enduit généralisé sur l''ensemble de la surface pour une finition sans défaut.', array['lissage', 'ratissage'], 'finished_surface', null, 170),
    ('plafonneur', 'plaf_isolation_laine', 'Isolation laine minérale en cloison', 'isolation', 'm2', 12.00, 17.00, 24.00, 'Fourniture et pose de laine minérale entre montants d''ossature.', array['laine', 'isolation cloison'], 'finished_surface', null, 180),
    ('plafonneur', 'plaf_cornieres_angles', 'Cornières d''angle', 'profiles_finition', 'ml', 5.00, 8.00, 12.00, 'Pose de profilés de renfort sur les angles saillants.', array['cornière', 'baguette d''angle'], 'per_unit', null, 190),
    ('plafonneur', 'plaf_poncage_finition', 'Ponçage de finition', 'poncage', 'm2', 4.00, 6.00, 9.00, 'Ponçage mécanique avec aspiration pour obtenir une surface prête à peindre.', array['ponçage'], 'finished_surface', null, 200),
    ('plafonneur', 'plaf_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Retrait des protections, aspiration et remise en état de la zone de travail.', array[]::text[], 'per_unit', null, 210),
    ('plafonneur', 'plaf_main_oeuvre', 'Main-d''œuvre plafonneur', 'other', 'h', 40.00, 50.00, 62.00, 'Intervention facturée à l''heure pour les travaux ne pouvant pas être calculés au m².', array[]::text[], 'per_unit', null, 220),

    -- -------------------------------------------------------------- CARRELEUR
    ('carreleur', 'carr_protection_chantier', 'Protection du chantier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Protection des sols conservés, des menuiseries et des accès avant intervention.', array['protection'], 'finished_surface', null, 10),
    ('carreleur', 'carr_depose_ancien_carrelage', 'Dépose d''ancien carrelage', 'depose_evacuation', 'm2', 15.00, 22.00, 32.00, 'Démolition du carrelage existant et de sa colle jusqu''au support.', array['dépose carrelage', 'démolition'], 'finished_surface', null, 20),
    ('carreleur', 'carr_evacuation_gravats', 'Évacuation des gravats', 'depose_evacuation', 'forfait', 120.00, 200.00, 320.00, 'Chargement, transport et mise en décharge agréée des déchets de chantier.', array['évacuation', 'gravats'], 'per_unit', null, 30),
    ('carreleur', 'carr_primaire_accrochage', 'Primaire d''accrochage', 'preparation_support', 'm2', 3.00, 5.00, 7.00, 'Application d''un primaire adapté avant ragréage, étanchéité ou encollage.', array['primaire'], 'finished_surface', null, 40),
    ('carreleur', 'carr_ragreage', 'Ragréage du sol avant pose', 'chape_ragreage', 'm2', 12.00, 18.00, 26.00, 'Ragréage autolissant destiné à rattraper les défauts de planéité du support.', array['ragréage', 'nivellement'], 'finished_surface', 'floor', 50),
    ('carreleur', 'carr_chape_ravoirage', 'Chape de ravoirage', 'chape_ragreage', 'm2', 22.00, 30.00, 42.00, 'Réalisation d''une chape de mise à niveau avant pose du revêtement.', array['chape', 'ravoirage'], 'finished_surface', 'floor', 60),
    ('carreleur', 'carr_etancheite_spec', 'Étanchéité sous carrelage', 'etancheite', 'm2', 28.00, 38.00, 52.00, 'Système de protection à l''eau sous carrelage pour douches et pièces humides.', array['étanchéité', 'SPEC', 'douche'], 'finished_surface', null, 70),
    ('carreleur', 'carr_bande_etancheite', 'Bande d''étanchéité d''angle', 'etancheite', 'ml', 12.00, 18.00, 26.00, 'Pose de bandes de renfort dans les angles et aux jonctions sol-mur.', array['bande étanchéité'], 'per_unit', null, 80),
    ('carreleur', 'carr_pose_sol_droite', 'Pose de carrelage au sol, pose droite', 'carrelage_sol', 'm2', 35.00, 45.00, 58.00, 'Encollage et pose droite de carreaux de format courant, hors fourniture.', array['carrelage sol', 'pose droite'], 'finished_surface', 'floor', 90),
    ('carreleur', 'carr_pose_sol_diagonale', 'Pose de carrelage au sol en diagonale', 'carrelage_sol', 'm2', 45.00, 56.00, 72.00, 'Pose en diagonale ou à cabochons, avec calepinage et découpes supplémentaires.', array['diagonale', 'calepinage'], 'finished_surface', 'floor', 100),
    ('carreleur', 'carr_pose_grand_format', 'Pose de carrelage grand format', 'carrelage_sol', 'm2', 52.00, 68.00, 88.00, 'Pose de carreaux grand format avec double encollage et système de nivellement.', array['grand format', 'dalle'], 'finished_surface', 'floor', 110),
    ('carreleur', 'carr_pose_faience', 'Pose de faïence murale', 'carrelage_mur', 'm2', 45.00, 58.00, 75.00, 'Pose de faïence sur mur préparé, y compris découpes autour des appareillages.', array['faïence', 'carrelage mural'], 'finished_surface', 'wall', 120),
    ('carreleur', 'carr_pose_mosaique', 'Pose de mosaïque', 'carrelage_mur', 'm2', 70.00, 95.00, 130.00, 'Pose de mosaïque en plaques, ajustement des trames et finitions soignées.', array['mosaïque'], 'finished_surface', 'wall', 130),
    ('carreleur', 'carr_joints_standard', 'Réalisation des joints', 'joints_carrelage', 'm2', 6.00, 9.00, 13.00, 'Jointoiement au mortier de joint, nettoyage et lissage.', array['joints'], 'finished_surface', null, 140),
    ('carreleur', 'carr_joints_epoxy', 'Joints époxy', 'joints_carrelage', 'm2', 14.00, 20.00, 28.00, 'Jointoiement époxy pour les zones exigeant une résistance chimique renforcée.', array['époxy'], 'finished_surface', null, 150),
    ('carreleur', 'carr_joint_silicone', 'Joint souple silicone', 'joints_carrelage', 'ml', 6.00, 9.00, 14.00, 'Réalisation des joints souples dans les angles et aux jonctions.', array['silicone', 'joint souple'], 'per_unit', null, 160),
    ('carreleur', 'carr_plinthes_carrelees', 'Pose de plinthes carrelées', 'plinthes', 'ml', 10.00, 14.00, 20.00, 'Découpe et pose de plinthes assorties au carrelage, joints compris.', array['plinthes carrelage'], 'per_unit', null, 170),
    ('carreleur', 'carr_profile_finition', 'Profilé de finition', 'profiles_finition', 'ml', 12.00, 17.00, 24.00, 'Pose de profilés de finition ou de protection d''angle en aluminium ou inox.', array['profilé', 'baguette'], 'per_unit', null, 180),
    ('carreleur', 'carr_decoupe_percement', 'Découpes et percements', 'other', 'qty', 12.00, 20.00, 32.00, 'Découpe ou percement spécifique pour passage de canalisation ou appareillage.', array['découpe', 'percement'], 'per_unit', null, 190),
    ('carreleur', 'carr_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Nettoyage du voile de ciment, retrait des protections et remise en état.', array['voile de ciment'], 'per_unit', null, 200),
    ('carreleur', 'carr_main_oeuvre', 'Main-d''œuvre carreleur', 'other', 'h', 42.00, 52.00, 64.00, 'Intervention facturée à l''heure pour les travaux ne pouvant pas être calculés au m².', array[]::text[], 'per_unit', null, 210),

    -- ----------------------------------------------------------------- SOLIER
    ('solier', 'sol_protection_chantier', 'Protection du chantier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Protection des accès, des menuiseries et des surfaces conservées.', array['protection'], 'finished_surface', null, 10),
    ('solier', 'sol_depose_revetement', 'Dépose d''ancien revêtement de sol', 'depose_evacuation', 'm2', 8.00, 12.00, 18.00, 'Retrait du revêtement existant et de ses résidus de colle.', array['dépose sol', 'arrachage'], 'finished_surface', 'floor', 20),
    ('solier', 'sol_depose_plinthes', 'Dépose des plinthes existantes', 'depose_evacuation', 'ml', 3.00, 5.00, 8.00, 'Démontage soigné des plinthes en place avant remplacement.', array['dépose plinthes'], 'per_unit', null, 30),
    ('solier', 'sol_evacuation_dechets', 'Évacuation des déchets', 'depose_evacuation', 'forfait', 100.00, 170.00, 280.00, 'Chargement, transport et mise en décharge agréée des déchets de chantier.', array['évacuation'], 'per_unit', null, 40),
    ('solier', 'sol_ragreage', 'Ragréage autolissant', 'chape_ragreage', 'm2', 12.00, 18.00, 26.00, 'Ragréage destiné à obtenir une planéité conforme à la pose du revêtement.', array['ragréage', 'nivellement'], 'finished_surface', 'floor', 50),
    ('solier', 'sol_primaire', 'Primaire d''accrochage sol', 'sous_couche_sol', 'm2', 3.00, 5.00, 7.00, 'Application d''un primaire adapté au support avant ragréage ou encollage.', array['primaire sol'], 'finished_surface', 'floor', 60),
    ('solier', 'sol_sous_couche_acoustique', 'Sous-couche acoustique', 'sous_couche_sol', 'm2', 4.00, 7.00, 11.00, 'Pose d''une sous-couche isolante réduisant les bruits d''impact.', array['sous-couche', 'acoustique'], 'finished_surface', 'floor', 70),
    ('solier', 'sol_parquet_flottant', 'Pose de parquet flottant', 'parquet', 'm2', 15.00, 21.00, 29.00, 'Pose flottante clipsée sur sous-couche, avec joints de dilatation périphériques.', array['parquet flottant', 'stratifié'], 'finished_surface', 'floor', 80),
    ('solier', 'sol_parquet_colle', 'Pose de parquet collé', 'parquet', 'm2', 30.00, 40.00, 55.00, 'Encollage plein sur support ragréé, pour un rendu stable et silencieux.', array['parquet collé'], 'finished_surface', 'floor', 90),
    ('solier', 'sol_parquet_massif_cloue', 'Pose de parquet massif cloué', 'parquet', 'm2', 45.00, 60.00, 80.00, 'Pose traditionnelle clouée sur lambourdes, y compris ajustements.', array['massif', 'cloué'], 'finished_surface', 'floor', 100),
    ('solier', 'sol_poncage_vitrification', 'Ponçage et vitrification de parquet', 'parquet', 'm2', 28.00, 38.00, 52.00, 'Ponçage multi-passes, dépoussiérage et application de couches de vitrificateur.', array['vitrification', 'ponçage parquet'], 'finished_surface', 'floor', 110),
    ('solier', 'sol_vinyle_lvt', 'Pose de vinyle LVT collé', 'sol_souple', 'm2', 20.00, 28.00, 38.00, 'Pose de lames ou dalles vinyle collées sur support ragréé.', array['LVT', 'vinyle', 'lames'], 'finished_surface', 'floor', 120),
    ('solier', 'sol_vinyle_rouleau', 'Pose de vinyle en rouleau', 'sol_souple', 'm2', 14.00, 20.00, 28.00, 'Pose de revêtement vinyle en lés, avec arasement et remontées si demandées.', array['rouleau', 'lés'], 'finished_surface', 'floor', 130),
    ('solier', 'sol_linoleum', 'Pose de linoléum', 'sol_souple', 'm2', 22.00, 30.00, 42.00, 'Pose de linoléum collé, soudure des joints à chaud si nécessaire.', array['linoléum', 'lino'], 'finished_surface', 'floor', 140),
    ('solier', 'sol_moquette_tendue', 'Pose de moquette tendue', 'moquette', 'm2', 12.00, 18.00, 25.00, 'Pose tendue sur bandes à griffes, avec thibaude si prévue.', array['moquette'], 'finished_surface', 'floor', 150),
    ('solier', 'sol_moquette_dalles', 'Pose de dalles de moquette', 'moquette', 'm2', 14.00, 20.00, 28.00, 'Pose de dalles plombantes ou collées, calepinage régulier.', array['dalles moquette'], 'finished_surface', 'floor', 160),
    ('solier', 'sol_plinthes_assorties', 'Pose de plinthes assorties', 'plinthes', 'ml', 8.00, 12.00, 17.00, 'Découpe et pose de plinthes assorties au revêtement, angles ajustés.', array['plinthes'], 'per_unit', null, 170),
    ('solier', 'sol_barre_seuil', 'Pose de barre de seuil', 'profiles_finition', 'qty', 15.00, 22.00, 32.00, 'Pose d''un profilé de seuil entre deux revêtements ou deux pièces.', array['barre de seuil', 'seuil'], 'per_unit', null, 180),
    ('solier', 'sol_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Aspiration, premier entretien du revêtement et retrait des protections.', array[]::text[], 'per_unit', null, 190),
    ('solier', 'sol_main_oeuvre', 'Main-d''œuvre poseur de sols', 'other', 'h', 38.00, 48.00, 60.00, 'Intervention facturée à l''heure pour les travaux ne pouvant pas être calculés au m².', array[]::text[], 'per_unit', null, 200),

    -- --------------------------------------------------------------- FACADIER
    ('facadier', 'fac_echafaudage', 'Montage et location d''échafaudage', 'echafaudage', 'm2', 12.00, 17.00, 24.00, 'Montage, location pour la durée du chantier et démontage de l''échafaudage.', array['échafaudage'], 'finished_surface', null, 10),
    ('facadier', 'fac_protection_abords', 'Protection des abords et menuiseries', 'protection_chantier', 'm2', 2.00, 3.50, 5.00, 'Bâchage des menuiseries, protection des plantations et des surfaces voisines.', array['protection', 'bâchage'], 'finished_surface', null, 20),
    ('facadier', 'fac_nettoyage_haute_pression', 'Nettoyage haute pression', 'nettoyage_facade', 'm2', 6.00, 9.00, 14.00, 'Nettoyage de la façade au jet haute pression, élimination des salissures.', array['karcher', 'haute pression', 'nettoyage façade'], 'finished_surface', 'facade', 30),
    ('facadier', 'fac_traitement_anti_mousse', 'Traitement anti-mousse', 'nettoyage_facade', 'm2', 5.00, 8.00, 12.00, 'Application d''un produit curatif contre mousses, algues et lichens.', array['anti-mousse', 'algues'], 'finished_surface', 'facade', 40),
    ('facadier', 'fac_reparation_fissures', 'Réparation de fissures', 'rebouchage', 'ml', 12.00, 18.00, 28.00, 'Ouverture, nettoyage et rebouchage des fissures non structurelles.', array['fissures'], 'per_unit', null, 50),
    ('facadier', 'fac_rejointoyage', 'Rejointoyage de maçonnerie', 'preparation_support', 'm2', 35.00, 50.00, 70.00, 'Dégarnissage des joints dégradés et réfection au mortier adapté.', array['rejointoyage', 'joints briques'], 'finished_surface', 'facade', 60),
    ('facadier', 'fac_primaire', 'Primaire de façade', 'preparation_support', 'm2', 7.00, 10.00, 15.00, 'Application d''un primaire régulateur d''absorption adapté au support.', array['primaire façade'], 'finished_surface', 'facade', 70),
    ('facadier', 'fac_enduit_mince', 'Enduit mince de façade', 'enduit_facade', 'm2', 32.00, 44.00, 60.00, 'Application d''un enduit mince organique ou minéral, finition talochée ou grattée.', array['enduit mince'], 'finished_surface', 'facade', 80),
    ('facadier', 'fac_crepi_projete', 'Crépi projeté', 'enduit_facade', 'm2', 38.00, 52.00, 70.00, 'Projection mécanique d''un crépi, grain et teinte selon le choix du client.', array['crépi', 'projeté'], 'finished_surface', 'facade', 90),
    ('facadier', 'fac_enduit_decoratif', 'Enduit décoratif de façade', 'enduit_facade', 'm2', 45.00, 62.00, 85.00, 'Enduit de finition décoratif appliqué manuellement, effet selon la teinte retenue.', array['enduit décoratif'], 'finished_surface', 'facade', 100),
    ('facadier', 'fac_ite_polystyrene', 'Isolation extérieure polystyrène 10 cm', 'isolation_exterieure', 'm2', 110.00, 140.00, 180.00, 'Système complet : panneaux, chevillage, armature, sous-enduit et finition.', array['ITE', 'polystyrène', 'isolation extérieure'], 'finished_surface', 'facade', 110),
    ('facadier', 'fac_ite_laine_roche', 'Isolation extérieure laine de roche', 'isolation_exterieure', 'm2', 135.00, 170.00, 215.00, 'Système complet en laine de roche, adapté aux exigences de réaction au feu.', array['laine de roche', 'ITE'], 'finished_surface', 'facade', 120),
    ('facadier', 'fac_profiles_depart', 'Profilés de départ et d''angle', 'profiles_finition', 'ml', 8.00, 12.00, 18.00, 'Pose des profilés de départ, d''angle et de couronnement du système.', array['profilé de départ'], 'per_unit', null, 130),
    ('facadier', 'fac_hydrofuge', 'Traitement hydrofuge', 'traitement_facade', 'm2', 10.00, 15.00, 22.00, 'Application d''un hydrofuge de surface limitant l''absorption d''eau.', array['hydrofuge', 'imperméabilisant'], 'finished_surface', 'facade', 140),
    ('facadier', 'fac_peinture_facade', 'Peinture de façade 2 couches', 'facade', 'm2', 23.00, 32.00, 45.00, 'Application de deux couches de peinture extérieure sur façade préparée.', array['peinture façade'], 'finished_surface', 'facade', 150),
    ('facadier', 'fac_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 120.00, 190.00, 300.00, 'Repli du chantier, nettoyage des abords et évacuation des déchets légers.', array[]::text[], 'per_unit', null, 160),
    ('facadier', 'fac_main_oeuvre', 'Main-d''œuvre façadier', 'other', 'h', 42.00, 52.00, 65.00, 'Intervention facturée à l''heure pour les travaux ne pouvant pas être calculés au m².', array[]::text[], 'per_unit', null, 170)
) as seed(
  trade_slug, catalog_key, name, category, unit,
  price_low, price_average, price_high, description,
  aliases, pricing_basis, surface_type, sort_order
)
join public.trades trade on trade.slug = seed.trade_slug
on conflict (trade_id, catalog_key) do update
set name = excluded.name,
    category = excluded.category,
    unit = excluded.unit,
    price_low = excluded.price_low,
    price_average = excluded.price_average,
    price_high = excluded.price_high,
    description = excluded.description,
    aliases = excluded.aliases,
    pricing_basis = excluded.pricing_basis,
    surface_type = excluded.surface_type,
    sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 7. Reprise de l'existant
-- ---------------------------------------------------------------------------

-- Toutes les prestations deja creees relevent du metier peintre.
update public.service_catalog
set trade_id = (select id from public.trades where slug = 'peintre')
where trade_id is null;

-- Les entreprises existantes ont donc le metier peintre actif.
insert into public.company_trades (company_id, trade_id)
select distinct company.id, trade.id
from public.companies company
cross join public.trades trade
where trade.slug = 'peintre'
on conflict (company_id, trade_id) do nothing;

-- ---------------------------------------------------------------------------
-- 8. Activation et desactivation
-- ---------------------------------------------------------------------------

-- Copie les prestations types manquantes. Une prestation deja presente, meme
-- renommee ou retarifee, n'est jamais ecrasee.
create or replace function public.copy_trade_services_to_company(
  p_owner_user_id uuid,
  p_company_id uuid,
  p_trade_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer;
begin
  insert into public.service_catalog (
    owner_user_id,
    company_id,
    trade_id,
    name,
    category,
    default_unit,
    default_unit_price_low_ht,
    default_unit_price_ht,
    default_unit_price_high_ht,
    default_tva_rate,
    default_description,
    default_metadata,
    is_active
  )
  select
    p_owner_user_id,
    p_company_id,
    template.trade_id,
    template.name,
    template.category,
    template.unit,
    template.price_low,
    template.price_average,
    template.price_high,
    21,
    template.description,
    jsonb_build_object(
      'default_catalog_key', template.catalog_key,
      'default_catalog_version', '2026-08-12',
      'selected_pricing_tier', 'prix_moyen',
      'pricing_tiers', jsonb_build_object(
        'petit_prix', template.price_low,
        'prix_moyen', template.price_average,
        'gros_prix', template.price_high
      )
    )
    || case
         when array_length(template.aliases, 1) is null then '{}'::jsonb
         else jsonb_build_object('aliases', to_jsonb(template.aliases))
       end
    || case
         when template.pricing_basis is null then '{}'::jsonb
         else jsonb_build_object('pricing_basis', template.pricing_basis)
       end
    || case
         when template.surface_type is null then '{}'::jsonb
         else jsonb_build_object('surface_type', template.surface_type)
       end,
    true
  from public.trade_service_templates template
  where template.trade_id = p_trade_id
    and template.is_active
    and not exists (
      select 1
      from public.service_catalog existing
      where (
        (p_company_id is not null and existing.company_id = p_company_id)
        or existing.owner_user_id = p_owner_user_id
      )
      and (
        existing.default_metadata ->> 'default_catalog_key' = template.catalog_key
        or lower(btrim(existing.name)) = lower(btrim(template.name))
      )
    );

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

create or replace function public.activate_company_trade(p_trade_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_trade public.trades%rowtype;
  v_services_added integer;
  v_services_restored integer;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(v_user_id);
  if v_company_id is null then
    raise exception 'Entreprise introuvable.' using errcode = 'P0002';
  end if;

  select * into v_trade
  from public.trades
  where slug = p_trade_slug and is_active;

  if not found then
    raise exception 'Metier inconnu : %.', p_trade_slug using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('company-trade:' || v_company_id::text, 0)
  );

  insert into public.company_trades (company_id, trade_id, activated_by)
  values (v_company_id, v_trade.id, v_user_id)
  on conflict (company_id, trade_id) do nothing;

  -- Reactivation apres un retrait : les prestations masquees par
  -- deactivate_company_trade doivent revenir, sinon le metier reviendrait
  -- avec un catalogue vide.
  update public.service_catalog
  set is_active = true
  where company_id = v_company_id
    and trade_id = v_trade.id
    and not is_active
    and default_metadata ->> 'default_catalog_key' in (
      select template.catalog_key
      from public.trade_service_templates template
      where template.trade_id = v_trade.id
    );

  get diagnostics v_services_restored = row_count;

  v_services_added := public.copy_trade_services_to_company(
    v_user_id, v_company_id, v_trade.id
  );

  return jsonb_build_object(
    'trade', v_trade.slug,
    'services_added', v_services_added,
    'services_restored', v_services_restored
  );
end;
$$;

-- Une prestation est masquable si elle correspond encore exactement au modele
-- et n'apparait dans aucun devis.
create or replace function public.is_untouched_trade_service(
  p_service_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not exists (
      select 1
      from public.quote_items item
      where item.service_catalog_id = p_service_id
    )
    and exists (
      select 1
      from public.service_catalog catalog
      join public.trade_service_templates template
        on template.trade_id = catalog.trade_id
       and template.catalog_key = catalog.default_metadata ->> 'default_catalog_key'
      where catalog.id = p_service_id
        and btrim(catalog.name) = btrim(template.name)
        and catalog.category = template.category
        and catalog.default_unit = template.unit
        and catalog.default_unit_price_ht = template.price_average
        and coalesce(btrim(catalog.default_description), '')
            = coalesce(btrim(template.description), '')
    );
$$;

-- Ce que la desactivation ferait, sans rien modifier. Alimente l'ecran de
-- confirmation : masquer un catalogue sans prevenir fait fuir un artisan.
create or replace function public.preview_company_trade_deactivation(
  p_trade_slug text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_trade_id uuid;
  v_hidden integer;
  v_kept integer;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(v_user_id);
  select id into v_trade_id from public.trades where slug = p_trade_slug;

  if v_company_id is null or v_trade_id is null then
    raise exception 'Metier ou entreprise introuvable.' using errcode = '22023';
  end if;

  select
    count(*) filter (where service.hideable),
    count(*) filter (where not service.hideable)
  into v_hidden, v_kept
  from (
    select public.is_untouched_trade_service(catalog.id) as hideable
    from public.service_catalog catalog
    where catalog.company_id = v_company_id
      and catalog.trade_id = v_trade_id
      and catalog.is_active
  ) as service;

  return jsonb_build_object(
    'trade', p_trade_slug,
    'services_to_hide', coalesce(v_hidden, 0),
    'services_kept', coalesce(v_kept, 0)
  );
end;
$$;

create or replace function public.deactivate_company_trade(p_trade_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_trade_id uuid;
  v_hidden integer := 0;
  v_remaining integer := 0;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(v_user_id);
  select id into v_trade_id from public.trades where slug = p_trade_slug;

  if v_company_id is null or v_trade_id is null then
    raise exception 'Metier ou entreprise introuvable.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.company_trades
    where company_id = v_company_id and trade_id = v_trade_id
  ) then
    raise exception 'Ce metier n''est pas active.' using errcode = '22023';
  end if;

  if (
    select count(*) from public.company_trades where company_id = v_company_id
  ) <= 1 then
    raise exception 'Au moins un metier doit rester actif.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('company-trade:' || v_company_id::text, 0)
  );

  update public.service_catalog
  set is_active = false
  where company_id = v_company_id
    and trade_id = v_trade_id
    and is_active
    and public.is_untouched_trade_service(id);

  get diagnostics v_hidden = row_count;

  select count(*) into v_remaining
  from public.service_catalog
  where company_id = v_company_id
    and trade_id = v_trade_id
    and is_active;

  delete from public.company_trades
  where company_id = v_company_id and trade_id = v_trade_id;

  return jsonb_build_object(
    'trade', p_trade_slug,
    'services_hidden', v_hidden,
    'services_kept', v_remaining
  );
end;
$$;

-- La seed historique lit desormais les modeles du metier peintre : une seule
-- source de verite, et les cles de catalogue restent identiques.
create or replace function public.seed_default_service_catalog(p_owner_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.resolve_user_company(p_owner_user_id);
  v_trade_id uuid;
begin
  select id into v_trade_id from public.trades where slug = 'peintre';
  if v_trade_id is null then
    return 0;
  end if;

  if v_company_id is not null then
    insert into public.company_trades (company_id, trade_id, activated_by)
    values (v_company_id, v_trade_id, p_owner_user_id)
    on conflict (company_id, trade_id) do nothing;
  end if;

  return public.copy_trade_services_to_company(
    p_owner_user_id, v_company_id, v_trade_id
  );
end;
$$;

revoke all on function public.copy_trade_services_to_company(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.is_untouched_trade_service(uuid)
  from public, anon;
revoke all on function public.activate_company_trade(text) from public, anon;
revoke all on function public.deactivate_company_trade(text) from public, anon;
revoke all on function public.preview_company_trade_deactivation(text)
  from public, anon;

grant execute on function public.activate_company_trade(text) to authenticated;
grant execute on function public.deactivate_company_trade(text) to authenticated;
grant execute on function public.preview_company_trade_deactivation(text)
  to authenticated;

comment on function public.activate_company_trade(text) is
  'Active un metier pour l''entreprise et copie les prestations types manquantes.';
comment on function public.deactivate_company_trade(text) is
  'Retire un metier. Ne supprime rien : masque uniquement les prestations ni modifiees ni utilisees.';
comment on function public.preview_company_trade_deactivation(text) is
  'Compte ce qu''une desactivation masquerait et conserverait, sans rien modifier.';

commit;

