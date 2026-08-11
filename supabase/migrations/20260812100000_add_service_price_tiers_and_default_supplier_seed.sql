begin;

-- Les trois paliers concernent uniquement le prix de vente des prestations.
-- Les lignes de devis restent des instantanes : cette migration ne les met pas a jour.
alter table public.service_catalog
  add column if not exists default_unit_price_low_ht numeric(12, 2),
  add column if not exists default_unit_price_high_ht numeric(12, 2);

create or replace function public.fill_service_catalog_price_tiers()
returns trigger
language plpgsql
set search_path = 'public'
as $$
begin
  new.default_unit_price_low_ht := coalesce(
    new.default_unit_price_low_ht,
    round((new.default_unit_price_ht * 0.75)::numeric, 2)
  );
  new.default_unit_price_high_ht := coalesce(
    new.default_unit_price_high_ht,
    round((new.default_unit_price_ht * 1.40)::numeric, 2)
  );
  return new;
end;
$$;

drop trigger if exists service_catalog_fill_price_tiers on public.service_catalog;
create trigger service_catalog_fill_price_tiers
before insert or update of default_unit_price_ht, default_unit_price_low_ht, default_unit_price_high_ht
on public.service_catalog
for each row execute function public.fill_service_catalog_price_tiers();

-- Reprend d'abord les paliers deja presents dans les metadonnees historiques.
-- Pour une prestation manuelle, seuls les deux nouveaux champs vides sont completes.
update public.service_catalog
set
  default_unit_price_low_ht = coalesce(
    default_unit_price_low_ht,
    case
      when coalesce(default_metadata #>> '{pricing_tiers,petit_prix}', '') ~ '^[0-9]+([.][0-9]+)?$'
        and (default_metadata #>> '{pricing_tiers,petit_prix}')::numeric <= default_unit_price_ht
        then (default_metadata #>> '{pricing_tiers,petit_prix}')::numeric
      else round((default_unit_price_ht * 0.75)::numeric, 2)
    end
  ),
  default_unit_price_high_ht = coalesce(
    default_unit_price_high_ht,
    case
      when coalesce(default_metadata #>> '{pricing_tiers,gros_prix}', '') ~ '^[0-9]+([.][0-9]+)?$'
        and (default_metadata #>> '{pricing_tiers,gros_prix}')::numeric >= default_unit_price_ht
        then (default_metadata #>> '{pricing_tiers,gros_prix}')::numeric
      else round((default_unit_price_ht * 1.40)::numeric, 2)
    end
  )
where default_unit_price_low_ht is null
   or default_unit_price_high_ht is null;

alter table public.service_catalog
  alter column default_unit_price_low_ht set not null,
  alter column default_unit_price_high_ht set not null;

alter table public.service_catalog
  drop constraint if exists service_catalog_price_tiers_non_negative,
  drop constraint if exists service_catalog_price_tiers_ordered,
  add constraint service_catalog_price_tiers_non_negative check (
    default_unit_price_low_ht >= 0 and default_unit_price_high_ht >= 0
  ),
  add constraint service_catalog_price_tiers_ordered check (
    default_unit_price_low_ht <= default_unit_price_ht
    and default_unit_price_ht <= default_unit_price_high_ht
  );

-- Cle technique reservee aux produits de demonstration. Elle permet de relancer
-- la seed autant de fois que necessaire sans modifier les produits de l'utilisateur.
alter table public.supply_products
  add column if not exists default_catalog_key text;

create unique index if not exists supply_products_company_default_key_unique
on public.supply_products(company_id, default_catalog_key)
where default_catalog_key is not null;

-- La fonction historique devient additive. Une prestation existante est reconnue
-- par sa cle de catalogue ou, pour les anciennes donnees, par son nom.
create or replace function public.seed_default_service_catalog(p_owner_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.resolve_user_company(p_owner_user_id);
  v_inserted_count integer;
begin
  insert into public.service_catalog (
    owner_user_id,
    company_id,
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
    v_company_id,
    defaults.name,
    defaults.category,
    defaults.unit,
    defaults.price_low,
    defaults.price_average,
    defaults.price_high,
    21,
    defaults.description,
    jsonb_build_object(
      'default_catalog_key', defaults.catalog_key,
      'default_catalog_version', '2026-08-12',
      'selected_pricing_tier', 'prix_moyen',
      'pricing_tiers', jsonb_build_object(
        'petit_prix', defaults.price_low,
        'prix_moyen', defaults.price_average,
        'gros_prix', defaults.price_high
      )
    ),
    true
  from (
    values
      ('protection_sols_mobilier', 'Protection des sols et du mobilier', 'protection_chantier', 'm2', 2.50, 3.50, 5.00, 'Mise en place de baches, films de protection et adhesifs. Comprend la pose et le retrait des protections.'),
      ('protection_complete_piece', 'Protection complète d''une pièce', 'protection_chantier', 'forfait', 75.00, 110.00, 160.00, 'Protection complète des sols, meubles, portes, fenêtres, prises et éléments fixes avant intervention.'),
      ('preparation_legere_support', 'Préparation légère du support', 'preparation_support', 'm2', 6.00, 9.00, 13.00, 'Dépoussiérage, contrôle du support, petites reprises ponctuelles et préparation avant mise en peinture.'),
      ('lessivage_murs_plafonds', 'Lessivage murs et plafonds', 'lessivage', 'm2', 3.50, 5.00, 7.50, 'Nettoyage du support afin d''eliminer les poussieres, salissures legeres et residus avant peinture.'),
      ('degraissage_intensif_support', 'Dégraissage intensif du support', 'lessivage', 'm2', 5.00, 7.50, 11.00, 'Nettoyage approfondi des surfaces grasses ou fortement encrassées, notamment dans les cuisines.'),
      ('grattage_peintures_non_adherentes', 'Grattage des peintures non adhérentes', 'grattage', 'm2', 5.00, 8.00, 12.00, 'Élimination des parties de peinture écaillées, cloquées ou non adhérentes avant réparation.'),
      ('depose_papier_peint_simple', 'Dépose de papier peint simple', 'grattage', 'm2', 8.00, 12.00, 18.00, 'Retrait d''un papier peint standard, hors réparation importante ou enduisage complet du support.'),
      ('rebouchage_ponctuel_defauts', 'Rebouchage ponctuel des défauts', 'rebouchage', 'm2', 5.00, 8.00, 12.00, 'Rebouchage localisé des trous de fixation, petits impacts et défauts superficiels.'),
      ('traitement_rebouchage_fissures', 'Traitement et rebouchage de fissures', 'rebouchage', 'ml', 7.00, 11.00, 16.00, 'Ouverture, nettoyage et rebouchage des fissures non structurelles avant ponçage et finition.'),
      ('enduit_local_reparation', 'Enduit local de réparation', 'enduit', 'm2', 10.00, 15.00, 22.00, 'Application localisée d''un enduit afin de corriger les défauts et remettre le support à niveau.'),
      ('enduisage_complet_support', 'Enduisage complet du support', 'enduit', 'm2', 18.00, 25.00, 35.00, 'Application d''un enduit généralisé pour obtenir une surface uniforme avant mise en peinture.'),
      ('enduit_decoratif_chaux', 'Enduit décoratif à la chaux', 'enduit', 'm2', 45.00, 65.00, 90.00, 'Application manuelle d''un enduit décoratif minéral avec effets et nuances selon la finition choisie.'),
      ('poncage_leger_support', 'Ponçage léger du support', 'poncage', 'm2', 3.00, 5.00, 7.00, 'Ponçage léger destiné à matifier et régulariser une surface avant l''application de peinture.'),
      ('poncage_mecanique_complet', 'Ponçage mécanique complet', 'poncage', 'm2', 7.00, 10.00, 15.00, 'Ponçage mécanique approfondi avec aspiration afin de corriger les irrégularités du support.'),
      ('impression_acrylique_standard', 'Impression acrylique standard', 'impression', 'm2', 5.00, 7.00, 10.00, 'Application d''une couche d''impression pour réguler l''absorption et favoriser l''adhérence.'),
      ('primaire_isolant_anti_taches', 'Primaire isolant anti-taches', 'impression', 'm2', 9.00, 13.00, 18.00, 'Application d''un primaire isolant sur les taches de nicotine, suie ou anciennes aureoles seches.'),
      ('peinture_murs_acrylique_2_couches', 'Peinture murs acrylique 2 couches', 'peinture_mur', 'm2', 15.00, 20.00, 28.00, 'Application de deux couches de peinture acrylique professionnelle sur un support prepare.'),
      ('peinture_murs_lessivable_satinee_2_couches', 'Peinture murs lessivable satinée 2 couches', 'peinture_mur', 'm2', 17.00, 23.00, 32.00, 'Application de deux couches de peinture résistante et lessivable adaptée aux zones sollicitées.'),
      ('peinture_murs_teinte_foncee_2_couches', 'Peinture murs teinte foncée 2 couches', 'peinture_mur', 'm2', 19.00, 26.00, 36.00, 'Application de deux couches dans une teinte soutenue nécessitant une mise en œuvre précise.'),
      ('peinture_plafond_mate_2_couches', 'Peinture plafond mate 2 couches', 'peinture_plafond', 'm2', 19.00, 25.00, 34.00, 'Application de deux couches de peinture mate professionnelle sur un plafond préparé.'),
      ('peinture_plafond_piece_humide', 'Peinture plafond pièce humide', 'peinture_plafond', 'm2', 22.00, 29.00, 39.00, 'Application de deux couches de peinture adaptée aux salles de bain, cuisines et pièces humides.'),
      ('peinture_boiseries_interieures', 'Peinture boiseries intérieures', 'boiseries', 'm2', 30.00, 42.00, 58.00, 'Préparation légère, sous-couche adaptée et application de deux couches de finition sur bois.'),
      ('peinture_chassis_interieur', 'Peinture châssis intérieur', 'boiseries', 'qty', 95.00, 140.00, 210.00, 'Préparation et peinture de la face intérieure d''un châssis de dimensions standard.'),
      ('peinture_porte_plane_une_face', 'Peinture porte plane une face', 'portes', 'qty', 65.00, 95.00, 145.00, 'Preparation legere et application de deux couches de peinture sur une face de porte plane.'),
      ('peinture_porte_complete_chambranles', 'Peinture porte complète et chambranles', 'portes', 'qty', 145.00, 210.00, 310.00, 'Préparation et peinture des deux faces, des chants, de l''encadrement et des chambranles.'),
      ('peinture_plinthes', 'Peinture plinthes', 'plinthes', 'ml', 7.00, 10.00, 15.00, 'Preparation legere et application de deux couches de finition sur les plinthes.'),
      ('peinture_radiateur_panneau', 'Peinture radiateur panneau', 'radiateurs', 'qty', 85.00, 125.00, 185.00, 'Nettoyage, preparation et application d''une peinture adaptee sur un radiateur panneau standard.'),
      ('peinture_radiateur_fonte_tubulaire', 'Peinture radiateur fonte ou tubulaire', 'radiateurs', 'qty', 160.00, 240.00, 360.00, 'Preparation et peinture d''un radiateur complexe comportant plusieurs colonnes ou elements.'),
      ('peinture_garde_corps_barriere_metallique', 'Peinture garde-corps ou barrière métallique', 'ferronneries', 'ml', 25.00, 38.00, 55.00, 'Préparation, traitement des points de corrosion et peinture d''une structure métallique linéaire.'),
      ('preparation_peinture_ferronnerie', 'Préparation et peinture de ferronnerie', 'ferronneries', 'm2', 32.00, 46.00, 65.00, 'Nettoyage, ponçage, primaire antirouille et application de deux couches de finition sur métal.'),
      ('nettoyage_facade_avant_peinture', 'Nettoyage de façade avant peinture', 'facade', 'm2', 6.00, 9.00, 14.00, 'Nettoyage de la façade et élimination des salissures superficielles avant préparation et peinture.'),
      ('reparation_fissures_facade', 'Réparation de fissures de façade', 'facade', 'ml', 10.00, 15.00, 24.00, 'Ouverture, nettoyage et réparation des fissures non structurelles présentes sur une façade.'),
      ('primaire_facade', 'Primaire pour façade', 'facade', 'm2', 7.00, 10.00, 15.00, 'Application d''un primaire extérieur adapté à la porosité et à la nature du support.'),
      ('peinture_facade_2_couches', 'Peinture de façade 2 couches', 'facade', 'm2', 23.00, 32.00, 45.00, 'Application de deux couches de peinture extérieure professionnelle sur une façade préparée.'),
      ('nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Retrait des protections, evacuation des dechets legers, aspiration et nettoyage de la zone.'),
      ('main_oeuvre_peintre', 'Main-d''œuvre peintre', 'other', 'h', 38.00, 48.00, 58.00, 'Intervention facturée à l''heure pour les travaux particuliers ne pouvant pas être calculés au m².'),
      ('journee_travail_peintre', 'Journée de travail peintre', 'other', 'jour', 304.00, 384.00, 464.00, 'Mise à disposition d''un peintre durant une journée de huit heures, hors fournitures spéciales.'),
      ('minimum_intervention', 'Minimum d''intervention', 'other', 'forfait', 160.00, 240.00, 350.00, 'Montant minimum applicable aux petits travaux afin de couvrir le deplacement et l''installation.'),
      ('echantillon_couleur_support', 'Échantillon de couleur sur support', 'other', 'qty', 20.00, 35.00, 55.00, 'Réalisation d''un échantillon de couleur directement sur le support avant validation définitive.'),
      ('fourniture_peinture_speciale', 'Fourniture de peinture spéciale', 'other', 'litre', 18.00, 28.00, 45.00, 'Fourniture d''une peinture technique, décorative ou spécifique non comprise dans le tarif standard.')
  ) as defaults(
    catalog_key,
    name,
    category,
    unit,
    price_low,
    price_average,
    price_high,
    description
  )
  where not exists (
    select 1
    from public.service_catalog existing
    where (
      (v_company_id is not null and existing.company_id = v_company_id)
      or existing.owner_user_id = p_owner_user_id
    )
    and (
      existing.default_metadata ->> 'default_catalog_key' = defaults.catalog_key
      or lower(btrim(existing.name)) = lower(btrim(defaults.name))
    )
  );

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

-- Compatibilite avec l'ancien nom RPC : il n'efface plus rien.
create or replace function public.reset_service_catalog_to_defaults()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  return public.seed_default_service_catalog(v_user_id);
end;
$$;

create or replace function public.seed_default_supplier_catalog(p_owner_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.resolve_user_company(p_owner_user_id);
  v_supplier_id uuid;
  v_product_id uuid;
  v_service_id uuid;
  v_product record;
  v_requirement record;
  v_delta integer;
  v_suppliers_added integer := 0;
  v_products_added integer := 0;
  v_offers_added integer := 0;
  v_links_added integer := 0;
begin
  if v_company_id is null then
    raise exception 'Entreprise introuvable pour le catalogue fournisseur.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('default-supplier:' || v_company_id::text, 0));

  select supplier.id
  into v_supplier_id
  from public.suppliers supplier
  where supplier.company_id = v_company_id
    and (
      lower(supplier.name) like '%centrale%'
      or lower(coalesce(supplier.website, '')) like '%proshop.be%'
    )
  order by case when lower(supplier.name) like '%centrale%' then 0 else 1 end, supplier.created_at
  limit 1;

  if v_supplier_id is null then
    insert into public.suppliers (
      company_id,
      created_by,
      name,
      email,
      phone,
      website,
      notes,
      is_active
    )
    values (
      v_company_id,
      p_owner_user_id,
      'Proshop Grace-Hollogne (La Centrale)',
      'gracehollogne@proshop.be',
      '+32 4 367 82 82',
      'https://proshop.be/nos-magasins/proshop-grace-hollogne',
      'Rue de Laguesse 19, 4460 Grace-Hollogne. Les prix de la seed sont des references publiques belges HT a confirmer aupres du fournisseur.',
      true
    )
    returning id into v_supplier_id;
    v_suppliers_added := 1;
  end if;

  for v_product in
    select *
    from (
      values
        ('trimetal_primer_10l', 'Trimetal Primer blanc 10 L', 'Trimetal', 'primaire_interieur', 10.000, 'L', 100.000, 'm2', '5410491191333', 88.00, 'https://www.painttrade.be/fr/peintures-interieures/2124-trimetal-primer-10l-blanc-5410491191333.html', 'Rendement 10 m2/L/couche. Prix public belge observe 106,48 EUR TVAC, converti a 88,00 EUR HT.'),
        ('trimetal_magnacryl_prestige_mat_10l', 'Magnacryl Prestige Mat blanc 10 L', 'Trimetal', 'peinture_interieure_mate', 10.000, 'L', 100.000, 'm2', '5410491180269', 128.64, 'https://www.painttrade.be/fr/peintures-interieures/38-trimetal-magnacryl-prestige-mat-blanc-10l-5410491180269.html', 'Rendement 10 m2/L/couche. Prix public belge observe 155,65 EUR TVAC, converti a 128,64 EUR HT.'),
        ('trimetal_magnacryl_prestige_velours_10l', 'Magnacryl Prestige Velours blanc 10 L', 'Trimetal', 'peinture_interieure_velours', 10.000, 'L', 100.000, 'm2', '5410491180832', 174.96, 'https://www.painttrade.be/fr/peintures-interieures/40-trimetal-magnacryl-prestige-velours-blanc-10l-5410491180832.html', 'Rendement indicatif 10 m2/L/couche. Prix public belge observe 211,70 EUR TVAC, converti a 174,96 EUR HT.'),
        ('trimetal_magnacryl_plafond_10l', 'Magnacryl Plafond blanc 10 L', 'Trimetal', 'peinture_plafond', 10.000, 'L', 100.000, 'm2', '5410491193795', 128.40, 'https://www.painttrade.be/fr/peintures-interieures/2120-trimetal-magnacryl-plafond-10l-blanc-5410491193795.html', 'Rendement indicatif 10 m2/L/couche. Prix public belge observe 155,36 EUR TVAC, converti a 128,40 EUR HT.'),
        ('trimetal_multiprimer_aqua_protect_1l', 'Multiprimer Aqua Protect 1 L', 'Trimetal', 'primaire_universel', 1.000, 'L', 10.000, 'm2', null, 30.42, 'https://www.painttrade.be/fr/peintures-interieures/201-multiprimer-aqua-protect-trimetal.html', 'Rendement conservateur 10 m2/L/couche. Prix public belge observe 36,81 EUR TVAC, converti a 30,42 EUR HT.'),
        ('trimetal_permacryl_xr_satin_1l', 'Permacryl XR Satin 1 L', 'Trimetal', 'laque_interieure', 1.000, 'L', 10.000, 'm2', '5410491152440', 37.58, 'https://www.painttrade.be/fr/peintures-interieures/146-trimetal-permacryl-xr-satin-5410491152440.html', 'Rendement 10 m2/L/couche. Prix public belge observe 45,47 EUR TVAC, converti a 37,58 EUR HT.'),
        ('trimetal_globacryl_facade_10l', 'Globacryl Facade satine 10 L', 'Trimetal', 'peinture_facade', 10.000, 'L', 110.000, 'm2', null, 191.44, 'https://www.painttrade.be/fr/peintures-exterieures/2152-peinture-satinee-globacryl-facade-trimetal-10l.html', 'Rendement 11 m2/L/couche. Prix public belge observe 231,64 EUR TVAC, converti a 191,44 EUR HT.')
    ) as product_seed(
      catalog_key,
      name,
      brand,
      category,
      package_quantity,
      package_unit,
      coverage_quantity,
      coverage_unit,
      supplier_sku,
      unit_price_ht,
      product_url,
      notes
    )
  loop
    v_product_id := null;

    select product.id
    into v_product_id
    from public.supply_products product
    where product.company_id = v_company_id
      and (
        product.default_catalog_key = v_product.catalog_key
        or (
          lower(coalesce(product.brand, '')) = lower(v_product.brand)
          and lower(btrim(product.name)) = lower(btrim(v_product.name))
        )
      )
    order by case when product.default_catalog_key = v_product.catalog_key then 0 else 1 end, product.created_at
    limit 1;

    if v_product_id is null then
      insert into public.supply_products (
        company_id,
        created_by,
        default_catalog_key,
        name,
        brand,
        category,
        package_quantity,
        package_unit,
        coverage_quantity,
        coverage_unit,
        notes,
        is_active
      )
      values (
        v_company_id,
        p_owner_user_id,
        v_product.catalog_key,
        v_product.name,
        v_product.brand,
        v_product.category,
        v_product.package_quantity,
        v_product.package_unit,
        v_product.coverage_quantity,
        v_product.coverage_unit,
        v_product.notes || ' Tarif indicatif au 12/08/2026, a confirmer chez La Centrale.',
        true
      )
      returning id into v_product_id;
      v_products_added := v_products_added + 1;
    end if;

    insert into public.supplier_product_offers (
      company_id,
      product_id,
      supplier_id,
      created_by,
      supplier_sku,
      unit_price_ht,
      tva_rate,
      product_url,
      price_updated_at,
      is_preferred,
      is_active
    )
    values (
      v_company_id,
      v_product_id,
      v_supplier_id,
      p_owner_user_id,
      v_product.supplier_sku,
      v_product.unit_price_ht,
      21,
      v_product.product_url,
      date '2026-08-12',
      true,
      true
    )
    on conflict (product_id, supplier_id) do nothing;

    get diagnostics v_delta = row_count;
    v_offers_added := v_offers_added + v_delta;
  end loop;

  for v_requirement in
    select *
    from (
      values
        ('impression_acrylique_standard', 'Impression acrylique standard', 'trimetal_primer_10l', 'Primaire', 1.00, 10.00, false, 10),
        ('primaire_isolant_anti_taches', 'Primaire isolant anti-taches', 'trimetal_multiprimer_aqua_protect_1l', 'Primaire isolant', 1.00, 10.00, false, 10),
        ('peinture_murs_acrylique_2_couches', 'Peinture murs acrylique 2 couches', 'trimetal_magnacryl_prestige_mat_10l', 'Finition mate', 2.00, 10.00, false, 20),
        ('peinture_murs_lessivable_satinee_2_couches', 'Peinture murs lessivable satinée 2 couches', 'trimetal_magnacryl_prestige_velours_10l', 'Finition lessivable', 2.00, 10.00, false, 20),
        ('peinture_murs_teinte_foncee_2_couches', 'Peinture murs teinte foncée 2 couches', 'trimetal_magnacryl_prestige_velours_10l', 'Finition teintée', 2.00, 15.00, false, 20),
        ('peinture_plafond_mate_2_couches', 'Peinture plafond mate 2 couches', 'trimetal_magnacryl_plafond_10l', 'Finition plafond', 2.00, 10.00, false, 20),
        ('peinture_plafond_piece_humide', 'Peinture plafond pièce humide', 'trimetal_magnacryl_prestige_velours_10l', 'Finition lessivable', 2.00, 10.00, false, 20),
        ('peinture_boiseries_interieures', 'Peinture boiseries intérieures', 'trimetal_multiprimer_aqua_protect_1l', 'Primaire', 1.00, 10.00, false, 10),
        ('peinture_boiseries_interieures', 'Peinture boiseries intérieures', 'trimetal_permacryl_xr_satin_1l', 'Finition satinée', 2.00, 10.00, false, 20),
        ('preparation_peinture_ferronnerie', 'Préparation et peinture de ferronnerie', 'trimetal_multiprimer_aqua_protect_1l', 'Primaire antirouille', 1.00, 10.00, false, 10),
        ('preparation_peinture_ferronnerie', 'Préparation et peinture de ferronnerie', 'trimetal_permacryl_xr_satin_1l', 'Finition satinée', 2.00, 10.00, false, 20),
        ('primaire_facade', 'Primaire pour façade', 'trimetal_multiprimer_aqua_protect_1l', 'Primaire façade', 1.00, 10.00, false, 10),
        ('peinture_facade_2_couches', 'Peinture de façade 2 couches', 'trimetal_globacryl_facade_10l', 'Finition façade', 2.00, 12.00, false, 20)
    ) as requirement_seed(
      service_key,
      service_name,
      product_key,
      usage_role,
      coats,
      waste_percent,
      is_optional,
      sort_order
    )
  loop
    v_service_id := null;
    v_product_id := null;

    select service.id
    into v_service_id
    from public.service_catalog service
    where (
      service.company_id = v_company_id
      or (service.company_id is null and service.owner_user_id = p_owner_user_id)
    )
      and (
        service.default_metadata ->> 'default_catalog_key' = v_requirement.service_key
        or lower(btrim(service.name)) = lower(btrim(v_requirement.service_name))
      )
    order by case
      when service.default_metadata ->> 'default_catalog_key' = v_requirement.service_key then 0
      else 1
    end, service.created_at
    limit 1;

    select product.id
    into v_product_id
    from public.supply_products product
    where product.company_id = v_company_id
      and product.default_catalog_key = v_requirement.product_key
    limit 1;

    if v_service_id is not null and v_product_id is not null then
      insert into public.service_material_requirements (
        company_id,
        service_catalog_id,
        product_id,
        created_by,
        usage_role,
        coats,
        waste_percent,
        notes,
        is_optional,
        is_active,
        sort_order
      )
      values (
        v_company_id,
        v_service_id,
        v_product_id,
        p_owner_user_id,
        v_requirement.usage_role,
        v_requirement.coats,
        v_requirement.waste_percent,
        'Liaison par defaut additive. Les modifications manuelles ne sont jamais remplacees.',
        v_requirement.is_optional,
        true,
        v_requirement.sort_order
      )
      on conflict (service_catalog_id, product_id, usage_role) do nothing;

      get diagnostics v_delta = row_count;
      v_links_added := v_links_added + v_delta;
    end if;
  end loop;

  return jsonb_build_object(
    'suppliers_added', v_suppliers_added,
    'products_added', v_products_added,
    'offers_added', v_offers_added,
    'links_added', v_links_added
  );
end;
$$;

create or replace function public.ensure_default_catalog_settings()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_services_added integer;
  v_supplier_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  v_services_added := public.seed_default_service_catalog(v_user_id);
  v_supplier_result := public.seed_default_supplier_catalog(v_user_id);

  return jsonb_build_object('services_added', v_services_added) || v_supplier_result;
end;
$$;

revoke all on function public.seed_default_supplier_catalog(uuid) from public;
revoke all on function public.ensure_default_catalog_settings() from public;
grant execute on function public.ensure_default_catalog_settings() to authenticated;
grant execute on function public.ensure_default_catalog_settings() to service_role;

comment on function public.ensure_default_catalog_settings() is
  'Ajoute uniquement les prestations, produits, offres et liaisons par defaut manquants. Ne met jamais a jour les devis ni les donnees manuelles existantes.';

commit;
