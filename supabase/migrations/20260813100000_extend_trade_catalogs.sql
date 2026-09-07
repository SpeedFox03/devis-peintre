begin;

-- Catalogues metiers complets et cinq metiers supplementaires.
--
-- Additif : aucune prestation existante n'est modifiee, aucune cle deja
-- utilisee n'est reprise. Les entreprises ayant deja active un metier
-- recuperent les nouveautes via sync_company_trade_catalogs().

-- ---------------------------------------------------------------------------
-- 1. Nouveaux metiers
-- ---------------------------------------------------------------------------

insert into public.trades (slug, name, description, sort_order)
values
  ('menuisier', 'Menuisier poseur', 'Pose de portes, chassis, placards, escaliers, volets et terrasses en bois.', 60),
  ('isolateur', 'Specialiste isolation', 'Isolation des combles, murs, sols et etancheite a l''air.', 70),
  ('nettoyage', 'Nettoyage professionnel', 'Fin de chantier, remise en etat, vitrerie et contrats d''entretien.', 80),
  ('paysagiste', 'Paysagiste', 'Amenagement exterieur, engazonnement, plantations, terrasses et cloture.', 90),
  ('ramoneur', 'Ramoneur et entretien chauffage', 'Ramonage, entretien des appareils de chauffage et controles reglementaires.', 100)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Nouvelles categories
-- ---------------------------------------------------------------------------

insert into public.catalog_categories (slug, label, sort_order)
values
  ('papier_peint', 'Papier peint et revetements muraux', 105),
  ('peinture_sol', 'Peinture de sol', 175),
  ('bardage', 'Bardage', 535),
  ('menuiserie_interieure', 'Menuiserie interieure', 600),
  ('menuiserie_exterieure', 'Menuiserie exterieure', 610),
  ('placard_dressing', 'Placards et dressings', 620),
  ('escalier', 'Escaliers', 630),
  ('volet_store', 'Volets et stores', 640),
  ('terrasse_bois', 'Terrasses en bois', 650),
  ('quincaillerie', 'Quincaillerie et reglages', 660),
  ('isolation_combles', 'Isolation des combles', 700),
  ('isolation_sol', 'Isolation des sols', 710),
  ('etancheite_air', 'Etancheite a l''air', 720),
  ('ventilation', 'Ventilation', 730),
  ('nettoyage_courant', 'Nettoyage courant', 800),
  ('nettoyage_vitrerie', 'Vitrerie', 810),
  ('nettoyage_specifique', 'Nettoyages specifiques', 820),
  ('entretien_recurrent', 'Contrats d''entretien', 830),
  ('preparation_terrain', 'Preparation du terrain', 850),
  ('engazonnement', 'Engazonnement', 855),
  ('plantation', 'Plantations', 860),
  ('cloture_portail', 'Clotures et portails', 865),
  ('terrasse_allee', 'Terrasses et allees', 870),
  ('arrosage', 'Arrosage', 875),
  ('entretien_jardin', 'Entretien de jardin', 880),
  ('elagage_abattage', 'Elagage et abattage', 885),
  ('ramonage', 'Ramonage', 890),
  ('entretien_chauffage', 'Entretien du chauffage', 893),
  ('controle_conformite', 'Controles et attestations', 896),
  ('depannage', 'Depannage', 898)
on conflict (slug) do update
set label = excluded.label,
    sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 3. Categories par metier
-- ---------------------------------------------------------------------------
-- Rejoue les dix metiers : les metiers deja en place recuperent ainsi les
-- categories ajoutees ici (papier peint, bardage, peinture de sol).

insert into public.trade_categories (trade_id, category_id, sort_order)
select trade.id, category.id, category.sort_order
from public.trades trade
join lateral (
  select unnest(
    case trade.slug
      when 'peintre' then array[
        'preparation_support', 'protection_chantier', 'lessivage', 'grattage', 'rebouchage', 'enduit', 'poncage', 'impression', 'peinture_mur', 'peinture_plafond', 'papier_peint', 'peinture_sol', 'boiseries', 'portes', 'plinthes', 'radiateurs', 'ferronneries', 'facade', 'nettoyage_fin_chantier', 'other'
      ]
      when 'plafonneur' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support', 'plafonnage', 'cloison_seche', 'faux_plafond', 'bandes_joints', 'isolation', 'enduit', 'poncage', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'carreleur' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support', 'chape_ragreage', 'etancheite', 'carrelage_sol', 'carrelage_mur', 'joints_carrelage', 'plinthes', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'solier' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support', 'chape_ragreage', 'sous_couche_sol', 'parquet', 'sol_souple', 'moquette', 'plinthes', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'facadier' then array[
        'protection_chantier', 'echafaudage', 'nettoyage_facade', 'preparation_support', 'rebouchage', 'depose_evacuation', 'enduit_facade', 'isolation_exterieure', 'bardage', 'traitement_facade', 'facade', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'menuisier' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support', 'menuiserie_interieure', 'menuiserie_exterieure', 'placard_dressing', 'escalier', 'volet_store', 'terrasse_bois', 'quincaillerie', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'isolateur' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_support', 'isolation_combles', 'isolation', 'isolation_sol', 'isolation_exterieure', 'etancheite_air', 'ventilation', 'profiles_finition', 'nettoyage_fin_chantier', 'other'
      ]
      when 'nettoyage' then array[
        'protection_chantier', 'depose_evacuation', 'nettoyage_courant', 'nettoyage_vitrerie', 'nettoyage_specifique', 'nettoyage_fin_chantier', 'entretien_recurrent', 'other'
      ]
      when 'paysagiste' then array[
        'protection_chantier', 'depose_evacuation', 'preparation_terrain', 'engazonnement', 'plantation', 'terrasse_allee', 'cloture_portail', 'arrosage', 'entretien_jardin', 'elagage_abattage', 'nettoyage_fin_chantier', 'other'
      ]
      when 'ramoneur' then array[
        'protection_chantier', 'ramonage', 'entretien_chauffage', 'controle_conformite', 'depannage', 'nettoyage_fin_chantier', 'other'
      ]
      else array[]::text[]
    end
  ) as slug
) as wanted on true
join public.catalog_categories category on category.slug = wanted.slug
on conflict (trade_id, category_id) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Prestations types
-- ---------------------------------------------------------------------------

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
    -- peintre
    ('peintre', 'pose_papier_peint_intisse', 'Pose de papier peint intissé', 'papier_peint', 'm2', 18.00, 25.00, 34.00, 'Préparation du support, encollage et pose de lés intissés avec raccords.', array['papier peint', 'intissé', 'tapisserie'], 'finished_surface', 'wall', 510),
    ('peintre', 'pose_toile_de_verre', 'Pose de toile de verre à peindre', 'papier_peint', 'm2', 16.00, 22.00, 30.00, 'Pose de toile de verre destinée à masquer les micro-fissures avant mise en peinture.', array['toile de verre', 'fibre de verre'], 'finished_surface', 'wall', 520),
    ('peintre', 'marouflage_avant_peinture', 'Marouflage avant peinture', 'enduit', 'm2', 14.00, 20.00, 28.00, 'Application d''une toile marouflée pour stabiliser un support fissuré.', array['marouflage'], 'finished_surface', null, 530),
    ('peintre', 'peinture_escalier_bois', 'Peinture d''escalier en bois', 'boiseries', 'qty', 280.00, 420.00, 620.00, 'Préparation, sous-couche et deux couches de finition sur un escalier complet.', array['escalier'], 'per_unit', 'woodwork', 540),
    ('peintre', 'lasure_boiseries_exterieures', 'Lasure de boiseries extérieures', 'boiseries', 'm2', 32.00, 45.00, 62.00, 'Ponçage, traitement et application de deux couches de lasure sur bois extérieur.', array['lasure', 'bois extérieur'], 'finished_surface', 'woodwork', 550),
    ('peintre', 'peinture_volets', 'Peinture de volets', 'boiseries', 'qty', 75.00, 115.00, 170.00, 'Préparation et peinture des deux faces d''un volet, quincaillerie déposée.', array['volet', 'persienne'], 'per_unit', 'woodwork', 560),
    ('peintre', 'peinture_porte_garage', 'Peinture de porte de garage', 'portes', 'qty', 180.00, 260.00, 380.00, 'Dégraissage, primaire adapté et deux couches de finition sur une porte de garage.', array['porte de garage', 'basculante'], 'per_unit', null, 570),
    ('peintre', 'traitement_salpetre', 'Traitement anti-salpêtre', 'preparation_support', 'm2', 22.00, 32.00, 45.00, 'Piquage des zones atteintes, traitement curatif et enduit d''assainissement.', array['salpêtre', 'remontée capillaire'], 'finished_surface', null, 580),
    ('peintre', 'traitement_moisissures', 'Traitement anti-moisissures', 'preparation_support', 'm2', 12.00, 18.00, 26.00, 'Élimination des moisissures et application d''un produit fongicide préventif.', array['moisissure', 'champignon'], 'finished_surface', null, 590),
    ('peintre', 'peinture_sol_beton', 'Peinture de sol béton', 'peinture_sol', 'm2', 18.00, 26.00, 38.00, 'Préparation mécanique, primaire et deux couches de peinture de sol résistante.', array['peinture sol', 'sol garage', 'béton'], 'finished_surface', 'floor', 600),
    ('peintre', 'peinture_cage_escalier', 'Peinture de cage d''escalier', 'peinture_mur', 'm2', 24.00, 32.00, 44.00, 'Mise en peinture d''une cage d''escalier, travail en hauteur et échafaudage compris.', array['cage d''escalier', 'hauteur'], 'finished_surface', 'wall', 610),
    ('peintre', 'echafaudage_interieur', 'Échafaudage intérieur', 'protection_chantier', 'forfait', 120.00, 190.00, 300.00, 'Montage et démontage d''un échafaudage roulant pour les travaux en hauteur.', array['échafaudage', 'roulant'], 'per_unit', null, 620),
    ('peintre', 'depose_repose_appareillages', 'Dépose et repose des appareillages', 'protection_chantier', 'qty', 8.00, 14.00, 22.00, 'Démontage puis remontage des prises, interrupteurs et luminaires.', array['prise', 'interrupteur'], 'per_unit', null, 630),
    ('peintre', 'peinture_plafond_3_couches', 'Peinture plafond 3 couches', 'peinture_plafond', 'm2', 26.00, 34.00, 46.00, 'Trois couches sur plafond exigeant, teinte couvrante ou support difficile.', array['trois couches', 'plafond'], 'finished_surface', 'ceiling', 640),
    ('peintre', 'finition_laque_boiseries', 'Finition laquée sur boiseries', 'boiseries', 'm2', 45.00, 62.00, 85.00, 'Ponçage fin entre couches et application d''une laque tendue haut de gamme.', array['laque', 'laqué'], 'finished_surface', 'woodwork', 650),
    -- plafonneur
    ('plafonneur', 'plaf_projete_machine', 'Plafonnage projeté à la machine', 'plafonnage', 'm2', 16.00, 22.00, 29.00, 'Projection mécanique de l''enduit, dressage et lissage manuel.', array['projeté', 'machine'], 'finished_surface', null, 510),
    ('plafonneur', 'plaf_angle_rentrant', 'Traitement des angles rentrants', 'bandes_joints', 'ml', 4.00, 6.00, 9.00, 'Bande et enduit dans les angles rentrants pour éviter la fissuration.', array['angle rentrant'], 'finished_surface', null, 520),
    ('plafonneur', 'plaf_cloison_coupe_feu', 'Cloison coupe-feu', 'cloison_seche', 'm2', 70.00, 90.00, 120.00, 'Cloison avec plaques et ossature répondant à une exigence de résistance au feu.', array['coupe-feu', 'EI30', 'EI60'], 'finished_surface', 'wall', 530),
    ('plafonneur', 'plaf_cloison_courbe', 'Cloison courbe', 'cloison_seche', 'm2', 90.00, 120.00, 160.00, 'Ossature cintrée et plaques cintrables pour une cloison à rayon.', array['courbe', 'cintrée'], 'finished_surface', 'wall', 540),
    ('plafonneur', 'plaf_doublage_colle', 'Doublage isolant collé', 'cloison_seche', 'm2', 45.00, 60.00, 80.00, 'Collage de panneaux composites isolant plus plaque sur mur existant.', array['doublage collé', 'complexe'], 'finished_surface', 'wall', 550),
    ('plafonneur', 'plaf_faux_plafond_acoustique', 'Faux plafond acoustique', 'faux_plafond', 'm2', 55.00, 72.00, 95.00, 'Plaques perforées ou dalles absorbantes sur ossature suspendue.', array['acoustique', 'absorption'], 'finished_surface', 'ceiling', 560),
    ('plafonneur', 'plaf_retombee', 'Retombée de plafond', 'faux_plafond', 'ml', 45.00, 62.00, 85.00, 'Réalisation d''une retombée périphérique ou décorative.', array['retombée', 'caisson'], 'finished_surface', null, 570),
    ('plafonneur', 'plaf_habillage_gaine', 'Habillage de gaine technique', 'cloison_seche', 'ml', 55.00, 75.00, 100.00, 'Coffrage d''une descente ou d''une gaine, prêt à enduire.', array['gaine', 'coffrage'], 'finished_surface', null, 580),
    ('plafonneur', 'plaf_niche_etagere', 'Niche ou étagère en plaques', 'cloison_seche', 'qty', 120.00, 180.00, 260.00, 'Création d''une niche ou d''une étagère maçonnée en plaques de plâtre.', array['niche', 'étagère'], 'per_unit', null, 590),
    ('plafonneur', 'plaf_renfort_ossature', 'Renfort d''ossature pour charge lourde', 'cloison_seche', 'qty', 35.00, 55.00, 80.00, 'Panneau ou traverse de renfort pour fixer un meuble ou un sanitaire.', array['renfort', 'fixation lourde'], 'per_unit', null, 600),
    ('plafonneur', 'plaf_isolation_soufflee', 'Isolation soufflée en plafond', 'isolation', 'm2', 15.00, 22.00, 32.00, 'Soufflage de laine au-dessus d''un plafond existant.', array['soufflée', 'flocons'], 'finished_surface', null, 610),
    ('plafonneur', 'plaf_pare_vapeur', 'Pose d''un pare-vapeur', 'isolation', 'm2', 6.00, 9.00, 14.00, 'Pose et calfeutrement d''une membrane pare-vapeur côté chaud.', array['pare-vapeur', 'membrane'], 'finished_surface', null, 620),
    ('plafonneur', 'plaf_joint_dilatation', 'Joint de dilatation', 'profiles_finition', 'ml', 8.00, 12.00, 18.00, 'Pose d''un profilé de fractionnement dans les grandes surfaces.', array['dilatation', 'fractionnement'], 'finished_surface', null, 630),
    ('plafonneur', 'plaf_reparation_plaque', 'Réparation localisée de plaque', 'plafonnage', 'qty', 65.00, 95.00, 140.00, 'Découpe, remplacement et raccord d''une zone de plaque endommagée.', array['réparation', 'trou'], 'per_unit', null, 640),
    ('plafonneur', 'plaf_arase_pied_cloison', 'Arase et calfeutrement en pied de cloison', 'profiles_finition', 'ml', 6.00, 9.00, 14.00, 'Calfeutrement acoustique en pied de cloison avant finition.', array['arase', 'bas de cloison'], 'finished_surface', null, 650),
    ('plafonneur', 'plaf_enduit_fibre', 'Enduit fibré haute résistance', 'enduit', 'm2', 16.00, 22.00, 30.00, 'Enduit chargé en fibres pour les supports sollicités ou fissurés.', array['fibré', 'armé'], 'finished_surface', null, 660),
    -- carreleur
    ('carreleur', 'carr_depose_faience', 'Dépose de faïence murale', 'depose_evacuation', 'm2', 14.00, 20.00, 28.00, 'Démolition de la faïence existante et de sa colle jusqu''au support.', array['dépose faïence'], 'finished_surface', 'wall', 510),
    ('carreleur', 'carr_chape_liquide', 'Chape liquide autonivelante', 'chape_ragreage', 'm2', 28.00, 38.00, 52.00, 'Coulage d''une chape fluide, planéité obtenue sans ragréage complémentaire.', array['chape liquide', 'anhydrite'], 'finished_surface', 'floor', 520),
    ('carreleur', 'carr_chape_seche', 'Chape sèche sur plots', 'chape_ragreage', 'm2', 35.00, 48.00, 65.00, 'Plots réglables et panneaux, solution sèche pour rénovation.', array['chape sèche', 'plots'], 'finished_surface', 'floor', 530),
    ('carreleur', 'carr_natte_desolidarisation', 'Natte de désolidarisation', 'etancheite', 'm2', 18.00, 26.00, 36.00, 'Pose d''une natte évitant la remontée des fissures du support.', array['natte', 'désolidarisation'], 'finished_surface', null, 540),
    ('carreleur', 'carr_receveur_maconne', 'Receveur de douche maçonné', 'etancheite', 'qty', 420.00, 620.00, 900.00, 'Forme de pente, étanchéité complète et préparation à la pose du carrelage.', array['receveur', 'douche italienne'], 'per_unit', null, 550),
    ('carreleur', 'carr_pose_exterieur', 'Pose de carrelage extérieur', 'carrelage_sol', 'm2', 42.00, 55.00, 72.00, 'Pose sur support extérieur avec colle et joints adaptés au gel.', array['extérieur', 'terrasse'], 'finished_surface', 'floor', 560),
    ('carreleur', 'carr_pose_plots', 'Pose de dalles sur plots', 'carrelage_sol', 'm2', 38.00, 50.00, 68.00, 'Dalles posées sur plots réglables, sans colle ni joint.', array['plots', 'dalle terrasse'], 'finished_surface', 'floor', 570),
    ('carreleur', 'carr_pose_chevrons', 'Pose en chevrons ou bâtons rompus', 'carrelage_sol', 'm2', 60.00, 78.00, 100.00, 'Calepinage en chevrons, découpes et ajustements nombreux.', array['chevron', 'bâtons rompus'], 'finished_surface', 'floor', 580),
    ('carreleur', 'carr_pose_escalier', 'Carrelage d''escalier', 'carrelage_sol', 'ml', 65.00, 90.00, 125.00, 'Habillage des marches et contremarches, nez de marche compris.', array['escalier', 'marche'], 'finished_surface', null, 590),
    ('carreleur', 'carr_credence', 'Pose de crédence', 'carrelage_mur', 'ml', 55.00, 75.00, 100.00, 'Pose d''une crédence de cuisine avec découpes autour des prises.', array['crédence'], 'finished_surface', 'wall', 600),
    ('carreleur', 'carr_listel_frise', 'Pose de listel ou frise', 'carrelage_mur', 'ml', 18.00, 26.00, 38.00, 'Pose d''un élément décoratif linéaire dans un calepinage.', array['listel', 'frise'], 'finished_surface', 'wall', 610),
    ('carreleur', 'carr_nez_marche', 'Pose de nez de marche', 'profiles_finition', 'ml', 15.00, 22.00, 32.00, 'Pose d''un profilé de nez de marche antidérapant.', array['nez de marche'], 'finished_surface', null, 620),
    ('carreleur', 'carr_seuil_pierre', 'Pose de seuil en pierre', 'profiles_finition', 'qty', 65.00, 95.00, 140.00, 'Découpe et scellement d''un seuil en pierre naturelle ou reconstituée.', array['seuil', 'pierre bleue'], 'per_unit', null, 630),
    ('carreleur', 'carr_rejointoiement', 'Réfection de joints existants', 'joints_carrelage', 'm2', 18.00, 26.00, 38.00, 'Dégarnissage des joints dégradés et réfection complète.', array['rejointoiement', 'refaire joints'], 'finished_surface', null, 640),
    ('carreleur', 'carr_hydrofuge_carrelage', 'Traitement hydrofuge du carrelage', 'joints_carrelage', 'm2', 8.00, 12.00, 18.00, 'Imperméabilisation des joints et des matériaux poreux.', array['hydrofuge', 'imperméabilisant'], 'finished_surface', null, 650),
    ('carreleur', 'carr_plinthe_pvc', 'Pose de plinthes PVC ou aluminium', 'plinthes', 'ml', 8.00, 12.00, 18.00, 'Pose de plinthes techniques collées ou clipsées.', array['plinthe pvc', 'plinthe alu'], 'finished_surface', null, 660),
    -- solier
    ('solier', 'sol_depose_moquette_collee', 'Dépose de moquette collée', 'depose_evacuation', 'm2', 10.00, 15.00, 22.00, 'Arrachage d''une moquette collée et retrait des résidus.', array['dépose moquette'], 'finished_surface', 'floor', 510),
    ('solier', 'sol_poncage_colle', 'Ponçage des résidus de colle', 'depose_evacuation', 'm2', 8.00, 12.00, 18.00, 'Ponçage mécanique avec aspiration pour retrouver un support sain.', array['ponçage colle', 'résidus'], 'finished_surface', 'floor', 520),
    ('solier', 'sol_ragreage_fibre', 'Ragréage fibré sur plancher bois', 'chape_ragreage', 'm2', 16.00, 23.00, 32.00, 'Ragréage armé de fibres adapté aux supports bois déformables.', array['ragréage fibré'], 'finished_surface', 'floor', 530),
    ('solier', 'sol_pare_vapeur', 'Pose d''un pare-vapeur', 'sous_couche_sol', 'm2', 3.00, 5.00, 8.00, 'Film pare-vapeur sous revêtement sur support susceptible de remontées.', array['pare-vapeur', 'film'], 'finished_surface', 'floor', 540),
    ('solier', 'sol_parquet_point_hongrie', 'Pose de parquet en point de Hongrie', 'parquet', 'm2', 55.00, 75.00, 100.00, 'Pose collée avec coupe d''onglet, calepinage exigeant.', array['point de hongrie', 'hongrie'], 'finished_surface', 'floor', 550),
    ('solier', 'sol_renovation_parquet', 'Rénovation de parquet ancien', 'parquet', 'm2', 35.00, 48.00, 65.00, 'Ponçage multi-passes, réparations ponctuelles et finition.', array['rénovation parquet'], 'finished_surface', 'floor', 560),
    ('solier', 'sol_huilage_parquet', 'Huilage de parquet', 'parquet', 'm2', 14.00, 20.00, 28.00, 'Application d''une huile-cire en deux passes avec lustrage.', array['huile', 'huilage'], 'finished_surface', 'floor', 570),
    ('solier', 'sol_remplacement_lames', 'Remplacement de lames abîmées', 'parquet', 'qty', 45.00, 65.00, 95.00, 'Dépose et remplacement de lames isolées avec raccord.', array['lame abîmée', 'remplacement lame'], 'per_unit', null, 580),
    ('solier', 'sol_lvt_pose_libre', 'Pose de LVT en pose libre', 'sol_souple', 'm2', 15.00, 22.00, 30.00, 'Dalles ou lames plombantes posées sans colle sur support préparé.', array['pose libre', 'plombant'], 'finished_surface', 'floor', 590),
    ('solier', 'sol_remontee_plinthe', 'Remontée en plinthe soudée', 'sol_souple', 'ml', 14.00, 20.00, 28.00, 'Remontée du revêtement en plinthe avec gorge et soudure.', array['remontée', 'plinthe souple'], 'finished_surface', null, 600),
    ('solier', 'sol_soudure_joints', 'Soudure à chaud des joints', 'sol_souple', 'ml', 8.00, 12.00, 18.00, 'Fraisage et soudure au cordon des joints entre lés.', array['soudure', 'cordon'], 'finished_surface', null, 610),
    ('solier', 'sol_moquette_escalier', 'Pose de moquette dans un escalier', 'moquette', 'ml', 35.00, 50.00, 70.00, 'Pose sur marches et contremarches, ajustements et fixations.', array['moquette escalier'], 'finished_surface', null, 620),
    ('solier', 'sol_thibaude', 'Pose de thibaude', 'moquette', 'm2', 5.00, 8.00, 12.00, 'Sous-couche de confort sous moquette tendue.', array['thibaude'], 'finished_surface', 'floor', 630),
    ('solier', 'sol_resine_epoxy', 'Application de résine époxy', 'sol_souple', 'm2', 45.00, 65.00, 90.00, 'Primaire, résine autolissante et finition sur sol technique.', array['résine', 'époxy'], 'finished_surface', 'floor', 640),
    ('solier', 'sol_profile_dilatation', 'Profilé de dilatation', 'profiles_finition', 'ml', 18.00, 26.00, 36.00, 'Pose d''un profilé de fractionnement dans les grandes surfaces.', array['dilatation'], 'finished_surface', null, 650),
    ('solier', 'sol_calfeutrement', 'Calfeutrement périphérique', 'profiles_finition', 'ml', 5.00, 8.00, 12.00, 'Joint souple périphérique entre revêtement et paroi.', array['calfeutrement', 'joint périphérique'], 'finished_surface', null, 660),
    -- facadier
    ('facadier', 'fac_sablage', 'Sablage de façade', 'nettoyage_facade', 'm2', 18.00, 26.00, 38.00, 'Décapage abrasif d''une façade fortement encrassée ou peinte.', array['sablage', 'aérogommage'], 'finished_surface', 'facade', 510),
    ('facadier', 'fac_gommage', 'Gommage doux de façade', 'nettoyage_facade', 'm2', 22.00, 32.00, 45.00, 'Nettoyage abrasif doux préservant les supports fragiles.', array['gommage'], 'finished_surface', 'facade', 520),
    ('facadier', 'fac_demoussage_toiture', 'Démoussage de toiture', 'nettoyage_facade', 'm2', 8.00, 12.00, 18.00, 'Brossage, traitement et rinçage des mousses en toiture.', array['démoussage', 'toiture'], 'finished_surface', null, 530),
    ('facadier', 'fac_piquage_enduit', 'Piquage d''enduit dégradé', 'depose_evacuation', 'm2', 14.00, 20.00, 30.00, 'Retrait mécanique de l''enduit non adhérent jusqu''au support sain.', array['piquage'], 'finished_surface', 'facade', 540),
    ('facadier', 'fac_evacuation_gravats', 'Évacuation des gravats', 'depose_evacuation', 'forfait', 150.00, 240.00, 380.00, 'Chargement, transport et mise en décharge agréée.', array['évacuation', 'gravats'], 'per_unit', null, 550),
    ('facadier', 'fac_armature_fibre', 'Pose d''armature en fibre de verre', 'enduit_facade', 'm2', 12.00, 18.00, 26.00, 'Marouflage d''une trame dans le sous-enduit pour limiter la fissuration.', array['armature', 'trame'], 'finished_surface', 'facade', 560),
    ('facadier', 'fac_enduit_chaux', 'Enduit à la chaux', 'enduit_facade', 'm2', 48.00, 65.00, 88.00, 'Enduit minéral respirant adapté aux maçonneries anciennes.', array['chaux'], 'finished_surface', 'facade', 570),
    ('facadier', 'fac_enduit_monocouche', 'Enduit monocouche projeté', 'enduit_facade', 'm2', 35.00, 48.00, 65.00, 'Enduit hydraulique projeté en une passe, finition grattée ou talochée.', array['monocouche'], 'finished_surface', 'facade', 580),
    ('facadier', 'fac_bardage_bois', 'Pose de bardage bois', 'bardage', 'm2', 85.00, 115.00, 155.00, 'Ossature, pare-pluie et lames bois, ventilation en lame d''air.', array['bardage bois', 'clin'], 'finished_surface', 'facade', 590),
    ('facadier', 'fac_bardage_composite', 'Pose de bardage composite', 'bardage', 'm2', 95.00, 130.00, 175.00, 'Bardage en panneaux composites sur ossature ventilée.', array['bardage composite', 'panneau'], 'finished_surface', 'facade', 600),
    ('facadier', 'fac_ite_fibre_bois', 'Isolation extérieure en fibre de bois', 'isolation_exterieure', 'm2', 145.00, 185.00, 235.00, 'Système biosourcé complet, panneaux, armature et finition.', array['fibre de bois', 'ITE biosourcée'], 'finished_surface', 'facade', 610),
    ('facadier', 'fac_appui_fenetre', 'Traitement des appuis de fenêtre', 'profiles_finition', 'ml', 25.00, 38.00, 55.00, 'Réfection ou habillage des appuis et rejingots.', array['appui', 'seuil fenêtre'], 'finished_surface', null, 620),
    ('facadier', 'fac_grille_ventilation', 'Pose de grilles de ventilation', 'profiles_finition', 'qty', 35.00, 55.00, 80.00, 'Pose de grilles anti-rongeurs en pied et tête de bardage.', array['grille', 'ventilation'], 'per_unit', null, 630),
    ('facadier', 'fac_anti_carbonatation', 'Peinture anti-carbonatation', 'traitement_facade', 'm2', 26.00, 36.00, 50.00, 'Revêtement protecteur du béton contre la carbonatation.', array['anti-carbonatation', 'béton'], 'finished_surface', 'facade', 640),
    ('facadier', 'fac_fissures_armee', 'Traitement de fissures avec armature', 'rebouchage', 'ml', 28.00, 40.00, 58.00, 'Ouverture, pontage armé et reprise d''enduit sur fissure évolutive.', array['fissure armée', 'pontage'], 'finished_surface', null, 650),
    ('facadier', 'fac_protection_vegetation', 'Protection des plantations et abords', 'protection_chantier', 'forfait', 90.00, 140.00, 220.00, 'Bâchage des massifs, protection des accès et du mobilier extérieur.', array['protection jardin'], 'per_unit', null, 660),
    -- menuisier
    ('menuisier', 'men_protection_chantier', 'Protection du chantier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Protection des sols et des surfaces conservées avant intervention.', array['protection'], 'finished_surface', null, 20),
    ('menuisier', 'men_depose_porte', 'Dépose d''une porte existante', 'depose_evacuation', 'qty', 35.00, 55.00, 80.00, 'Démontage du vantail, du bâti et des habillages.', array['dépose porte'], 'per_unit', null, 30),
    ('menuisier', 'men_depose_chassis', 'Dépose d''un châssis existant', 'depose_evacuation', 'qty', 85.00, 130.00, 190.00, 'Découpe et retrait du châssis, préparation de la baie.', array['dépose châssis', 'dépose fenêtre'], 'per_unit', null, 40),
    ('menuisier', 'men_evacuation', 'Évacuation des menuiseries déposées', 'depose_evacuation', 'forfait', 100.00, 170.00, 280.00, 'Chargement, transport et mise en décharge agréée.', array['évacuation'], 'per_unit', null, 50),
    ('menuisier', 'men_prise_cotes', 'Prise de cotes et métré', 'preparation_support', 'forfait', 80.00, 120.00, 180.00, 'Relevé précis sur site avant commande des menuiseries.', array['métré', 'relevé'], 'per_unit', null, 60),
    ('menuisier', 'men_pose_bloc_porte', 'Pose d''un bloc-porte intérieur', 'menuiserie_interieure', 'qty', 140.00, 200.00, 290.00, 'Pose du bâti, réglage du vantail et fixation des habillages.', array['bloc-porte', 'porte intérieure'], 'per_unit', null, 70),
    ('menuisier', 'men_pose_porte_coulissante', 'Pose d''une porte coulissante', 'menuiserie_interieure', 'qty', 220.00, 320.00, 460.00, 'Pose du rail, du vantail et des finitions en applique.', array['coulissante'], 'per_unit', null, 80),
    ('menuisier', 'men_pose_porte_galandage', 'Pose d''une porte à galandage', 'menuiserie_interieure', 'qty', 380.00, 540.00, 760.00, 'Pose du châssis à galandage dans la cloison et réglage complet.', array['galandage'], 'per_unit', null, 90),
    ('menuisier', 'men_habillage_embrasure', 'Habillage d''embrasure', 'menuiserie_interieure', 'ml', 35.00, 50.00, 70.00, 'Fourniture et pose des habillages et chambranles.', array['embrasure', 'chambranle'], 'finished_surface', null, 100),
    ('menuisier', 'men_pose_chassis_pvc', 'Pose d''un châssis PVC', 'menuiserie_exterieure', 'qty', 180.00, 260.00, 380.00, 'Pose, calage, fixation et réglage d''un châssis PVC.', array['châssis pvc', 'fenêtre pvc'], 'per_unit', null, 110),
    ('menuisier', 'men_pose_chassis_alu', 'Pose d''un châssis aluminium', 'menuiserie_exterieure', 'qty', 220.00, 320.00, 450.00, 'Pose et réglage d''un châssis aluminium à rupture de pont thermique.', array['châssis alu'], 'per_unit', null, 120),
    ('menuisier', 'men_pose_chassis_bois', 'Pose d''un châssis bois', 'menuiserie_exterieure', 'qty', 240.00, 340.00, 480.00, 'Pose et réglage d''un châssis bois, traitement des appuis.', array['châssis bois'], 'per_unit', null, 130),
    ('menuisier', 'men_pose_porte_entree', 'Pose d''une porte d''entrée', 'menuiserie_exterieure', 'qty', 320.00, 460.00, 650.00, 'Pose du bloc-porte, réglage, serrure et étanchéité périphérique.', array['porte d''entrée'], 'per_unit', null, 140),
    ('menuisier', 'men_pose_porte_service', 'Pose d''une porte de service', 'menuiserie_exterieure', 'qty', 260.00, 380.00, 540.00, 'Pose et réglage d''une porte de service ou de garage piétonne.', array['porte de service'], 'per_unit', null, 150),
    ('menuisier', 'men_pose_baie_coulissante', 'Pose d''une baie coulissante', 'menuiserie_exterieure', 'qty', 450.00, 650.00, 920.00, 'Pose d''une baie vitrée coulissante, seuil et étanchéité compris.', array['baie vitrée', 'coulissant'], 'per_unit', null, 160),
    ('menuisier', 'men_etancheite_menuiserie', 'Étanchéité périphérique de menuiserie', 'menuiserie_exterieure', 'ml', 12.00, 18.00, 26.00, 'Mousse, fond de joint et mastic sur le pourtour de la menuiserie.', array['étanchéité', 'mastic'], 'finished_surface', null, 170),
    ('menuisier', 'men_pose_seuil', 'Pose d''un seuil de porte', 'profiles_finition', 'qty', 65.00, 95.00, 140.00, 'Découpe et scellement d''un seuil aluminium ou pierre.', array['seuil'], 'per_unit', null, 180),
    ('menuisier', 'men_placard_sur_mesure', 'Placard sur mesure', 'placard_dressing', 'm2', 320.00, 450.00, 620.00, 'Fabrication et pose d''un placard sur mesure, aménagement intérieur compris.', array['placard', 'sur mesure'], 'finished_surface', null, 190),
    ('menuisier', 'men_dressing_amenage', 'Dressing aménagé', 'placard_dressing', 'm2', 380.00, 540.00, 750.00, 'Dressing complet avec penderies, tiroirs et étagères.', array['dressing'], 'finished_surface', null, 200),
    ('menuisier', 'men_porte_placard_coulissante', 'Pose de portes de placard coulissantes', 'placard_dressing', 'qty', 180.00, 260.00, 370.00, 'Pose des rails et des vantaux coulissants, réglage.', array['porte placard'], 'per_unit', null, 210),
    ('menuisier', 'men_etagere_sur_mesure', 'Étagère sur mesure', 'placard_dressing', 'ml', 85.00, 125.00, 180.00, 'Fabrication et pose d''une étagère ajustée à l''espace.', array['étagère', 'tablette'], 'finished_surface', null, 220),
    ('menuisier', 'men_pose_escalier_droit', 'Pose d''un escalier droit', 'escalier', 'qty', 850.00, 1250.00, 1800.00, 'Pose et fixation d''un escalier droit préfabriqué.', array['escalier droit'], 'per_unit', null, 230),
    ('menuisier', 'men_pose_escalier_tournant', 'Pose d''un escalier quart tournant', 'escalier', 'qty', 1200.00, 1750.00, 2500.00, 'Pose d''un escalier quart ou demi-tournant avec ajustements.', array['quart tournant', 'tournant'], 'per_unit', null, 240),
    ('menuisier', 'men_renovation_escalier', 'Rénovation d''un escalier existant', 'escalier', 'qty', 550.00, 800.00, 1150.00, 'Habillage des marches, reprise des contremarches et ponçage.', array['rénovation escalier'], 'per_unit', null, 250),
    ('menuisier', 'men_pose_garde_corps', 'Pose d''un garde-corps', 'escalier', 'ml', 180.00, 260.00, 380.00, 'Pose d''un garde-corps bois, métal ou verre conforme aux normes.', array['garde-corps', 'rampe'], 'finished_surface', null, 260),
    ('menuisier', 'men_pose_volet_battant', 'Pose de volets battants', 'volet_store', 'qty', 180.00, 260.00, 370.00, 'Pose des pentures, gonds et arrêts, réglage de la fermeture.', array['volet battant'], 'per_unit', null, 270),
    ('menuisier', 'men_pose_volet_roulant', 'Pose d''un volet roulant', 'volet_store', 'qty', 220.00, 320.00, 450.00, 'Pose d''un volet roulant en applique ou sous linteau.', array['volet roulant'], 'per_unit', null, 280),
    ('menuisier', 'men_motorisation_volet', 'Motorisation d''un volet', 'volet_store', 'qty', 180.00, 260.00, 380.00, 'Pose du moteur, raccordement et paramétrage de la commande.', array['motorisation', 'somfy'], 'per_unit', null, 290),
    ('menuisier', 'men_pose_store_banne', 'Pose d''un store banne', 'volet_store', 'qty', 350.00, 500.00, 720.00, 'Fixation du store, réglage de l''inclinaison et de la commande.', array['store banne'], 'per_unit', null, 300),
    ('menuisier', 'men_terrasse_bois', 'Terrasse en bois sur lambourdes', 'terrasse_bois', 'm2', 85.00, 115.00, 155.00, 'Plots, lambourdes et lames bois vissées ou clipsées.', array['terrasse bois'], 'finished_surface', 'floor', 310),
    ('menuisier', 'men_terrasse_composite', 'Terrasse en composite', 'terrasse_bois', 'm2', 95.00, 130.00, 175.00, 'Structure et lames composites, finitions périphériques comprises.', array['terrasse composite'], 'finished_surface', 'floor', 320),
    ('menuisier', 'men_pose_quincaillerie', 'Pose de quincaillerie', 'quincaillerie', 'qty', 25.00, 40.00, 60.00, 'Pose de poignées, serrures, paumelles ou ferme-portes.', array['poignée', 'serrure', 'quincaillerie'], 'per_unit', null, 330),
    ('menuisier', 'men_reglage_menuiserie', 'Réglage et entretien de menuiserie', 'quincaillerie', 'qty', 45.00, 70.00, 105.00, 'Réglage des ouvrants, graissage et remplacement des joints.', array['réglage', 'entretien'], 'per_unit', null, 340),
    ('menuisier', 'men_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Retrait des protections, aspiration et évacuation des chutes.', array[]::text[], 'per_unit', null, 350),
    ('menuisier', 'men_main_oeuvre', 'Main-d''œuvre menuisier', 'other', 'h', 45.00, 58.00, 72.00, 'Intervention facturée à l''heure pour les travaux hors forfait.', array[]::text[], 'per_unit', null, 360),
    -- isolateur
    ('isolateur', 'iso_protection_chantier', 'Protection du chantier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Protection des accès et des surfaces conservées.', array['protection'], 'finished_surface', null, 20),
    ('isolateur', 'iso_depose_ancienne', 'Dépose d''ancienne isolation', 'depose_evacuation', 'm2', 12.00, 18.00, 26.00, 'Retrait et ensachage d''une isolation dégradée ou tassée.', array['dépose isolation'], 'finished_surface', null, 30),
    ('isolateur', 'iso_evacuation', 'Évacuation des déchets d''isolation', 'depose_evacuation', 'forfait', 120.00, 200.00, 320.00, 'Transport et mise en décharge agréée des matériaux déposés.', array['évacuation'], 'per_unit', null, 40),
    ('isolateur', 'iso_diagnostic', 'Diagnostic et relevé thermique', 'preparation_support', 'forfait', 180.00, 280.00, 420.00, 'Relevé des surfaces, contrôle du support et préconisations.', array['diagnostic', 'audit'], 'per_unit', null, 50),
    ('isolateur', 'iso_traitement_charpente', 'Traitement de charpente avant isolation', 'preparation_support', 'm2', 12.00, 18.00, 26.00, 'Traitement préventif ou curatif du bois avant fermeture.', array['traitement charpente', 'xylophage'], 'finished_surface', null, 60),
    ('isolateur', 'iso_combles_soufflee', 'Isolation de combles perdus par soufflage', 'isolation_combles', 'm2', 18.00, 26.00, 36.00, 'Soufflage mécanique de laine en vrac à l''épaisseur prescrite.', array['soufflage', 'combles perdus'], 'finished_surface', null, 70),
    ('isolateur', 'iso_combles_deroulee', 'Isolation de combles par déroulage', 'isolation_combles', 'm2', 22.00, 30.00, 42.00, 'Pose croisée de rouleaux sur plancher de combles.', array['déroulage', 'rouleaux'], 'finished_surface', null, 80),
    ('isolateur', 'iso_rampants_2_couches', 'Isolation de rampants en deux couches', 'isolation_combles', 'm2', 42.00, 58.00, 78.00, 'Deux couches croisées entre et sous chevrons, ossature comprise.', array['rampants', 'sous toiture'], 'finished_surface', null, 90),
    ('isolateur', 'iso_sarking', 'Isolation par sarking', 'isolation_combles', 'm2', 95.00, 130.00, 175.00, 'Isolation par l''extérieur de la toiture, sous couverture déposée.', array['sarking'], 'finished_surface', null, 100),
    ('isolateur', 'iso_plancher_combles', 'Plancher de combles sur isolation', 'isolation_combles', 'm2', 32.00, 45.00, 62.00, 'Plancher technique surélevé préservant l''épaisseur d''isolant.', array['plancher combles'], 'finished_surface', 'floor', 110),
    ('isolateur', 'iso_mur_ossature', 'Isolation de mur par l''intérieur sur ossature', 'isolation', 'm2', 45.00, 62.00, 85.00, 'Ossature, isolant, pare-vapeur et parement prêt à finir.', array['isolation intérieure', 'contre-cloison'], 'finished_surface', 'wall', 120),
    ('isolateur', 'iso_mur_doublage_colle', 'Doublage isolant collé', 'isolation', 'm2', 42.00, 58.00, 78.00, 'Collage de panneaux composites isolant plus plaque.', array['doublage collé'], 'finished_surface', 'wall', 130),
    ('isolateur', 'iso_injection_coulisse', 'Injection dans le mur creux', 'isolation', 'm2', 22.00, 32.00, 45.00, 'Remplissage de la coulisse par injection de billes ou de mousse.', array['mur creux', 'coulisse', 'injection'], 'finished_surface', 'wall', 140),
    ('isolateur', 'iso_cave_plafond', 'Isolation du plafond de cave', 'isolation_sol', 'm2', 28.00, 40.00, 55.00, 'Panneaux fixés en sous-face de la dalle de cave ou de garage.', array['plafond cave', 'sous-face'], 'finished_surface', null, 150),
    ('isolateur', 'iso_sous_chape', 'Isolation sous chape', 'isolation_sol', 'm2', 18.00, 26.00, 36.00, 'Panneaux isolants et bande périphérique avant coulage de chape.', array['sous chape'], 'finished_surface', 'floor', 160),
    ('isolateur', 'iso_vide_sanitaire', 'Isolation de vide sanitaire', 'isolation_sol', 'm2', 32.00, 45.00, 62.00, 'Isolation projetée ou panneaux en sous-face du plancher bas.', array['vide sanitaire'], 'finished_surface', null, 170),
    ('isolateur', 'iso_ite_enduite', 'Isolation extérieure avec finition enduite', 'isolation_exterieure', 'm2', 120.00, 155.00, 200.00, 'Système complet panneaux, armature, sous-enduit et finition.', array['ITE', 'isolation extérieure'], 'finished_surface', 'facade', 180),
    ('isolateur', 'iso_pare_vapeur', 'Pose d''un pare-vapeur', 'etancheite_air', 'm2', 8.00, 12.00, 18.00, 'Membrane pare-vapeur posée et calfeutrée côté chaud.', array['pare-vapeur'], 'finished_surface', null, 190),
    ('isolateur', 'iso_membrane_hygrovariable', 'Pose d''une membrane hygrovariable', 'etancheite_air', 'm2', 12.00, 18.00, 26.00, 'Membrane à perméance variable avec adhésifs et raccords.', array['hygrovariable', 'frein-vapeur'], 'finished_surface', null, 200),
    ('isolateur', 'iso_calfeutrement', 'Calfeutrement des pénétrations', 'etancheite_air', 'qty', 25.00, 40.00, 60.00, 'Traitement étanche des passages de gaines et conduits.', array['calfeutrement', 'pénétration'], 'per_unit', null, 210),
    ('isolateur', 'iso_test_infiltrometrie', 'Test d''infiltrométrie', 'etancheite_air', 'forfait', 380.00, 550.00, 780.00, 'Mesure de la perméabilité à l''air et rapport de conformité.', array['blower door', 'infiltrométrie'], 'per_unit', null, 220),
    ('isolateur', 'iso_grille_ventilation', 'Pose de grilles de ventilation', 'ventilation', 'qty', 45.00, 70.00, 105.00, 'Grilles d''amenée d''air ou de transfert dans les menuiseries et cloisons.', array['grille', 'amenée d''air'], 'per_unit', null, 230),
    ('isolateur', 'iso_vmc_simple_flux', 'Pose d''une VMC simple flux', 'ventilation', 'qty', 550.00, 800.00, 1150.00, 'Caisson, réseau de gaines et bouches, raccordement compris.', array['VMC', 'ventilation'], 'per_unit', null, 240),
    ('isolateur', 'iso_habillage_finition', 'Habillage et finition en plaques', 'profiles_finition', 'm2', 32.00, 45.00, 62.00, 'Parement en plaques de plâtre prêt à enduire après isolation.', array['habillage', 'parement'], 'finished_surface', null, 250),
    ('isolateur', 'iso_nettoyage_fin_chantier', 'Nettoyage de fin de chantier', 'nettoyage_fin_chantier', 'forfait', 80.00, 130.00, 210.00, 'Aspiration, retrait des protections et évacuation des chutes.', array[]::text[], 'per_unit', null, 260),
    ('isolateur', 'iso_main_oeuvre', 'Main-d''œuvre isolation', 'other', 'h', 42.00, 52.00, 65.00, 'Intervention facturée à l''heure pour les travaux hors forfait.', array[]::text[], 'per_unit', null, 270),
    -- nettoyage
    ('nettoyage', 'net_protection_mobilier', 'Protection du mobilier', 'protection_chantier', 'm2', 2.00, 3.00, 4.50, 'Bâchage du mobilier et des surfaces sensibles avant intervention.', array['protection'], 'finished_surface', null, 20),
    ('nettoyage', 'net_fin_chantier_complet', 'Nettoyage complet de fin de chantier', 'nettoyage_fin_chantier', 'm2', 4.00, 6.00, 9.00, 'Dépoussiérage intégral, sols, vitres, sanitaires et menuiseries.', array['fin de chantier', 'nettoyage complet'], 'finished_surface', null, 30),
    ('nettoyage', 'net_fin_chantier_leger', 'Nettoyage léger de fin de chantier', 'nettoyage_fin_chantier', 'm2', 2.50, 4.00, 6.00, 'Passage rapide après des travaux peu salissants.', array['nettoyage léger'], 'finished_surface', null, 40),
    ('nettoyage', 'net_retrait_protections', 'Retrait des protections de chantier', 'nettoyage_fin_chantier', 'm2', 1.50, 2.50, 4.00, 'Dépose et évacuation des bâches, films et adhésifs.', array['retrait protections'], 'finished_surface', null, 50),
    ('nettoyage', 'net_depoussierage', 'Dépoussiérage complet', 'nettoyage_courant', 'm2', 2.00, 3.50, 5.00, 'Dépoussiérage des surfaces horizontales et verticales accessibles.', array['dépoussiérage'], 'finished_surface', null, 60),
    ('nettoyage', 'net_sols_durs', 'Nettoyage des sols durs', 'nettoyage_courant', 'm2', 2.00, 3.00, 4.50, 'Aspiration et lavage mécanisé ou manuel des sols durs.', array['lavage sol'], 'finished_surface', 'floor', 70),
    ('nettoyage', 'net_sanitaires', 'Nettoyage et désinfection des sanitaires', 'nettoyage_courant', 'qty', 25.00, 40.00, 60.00, 'Détartrage, désinfection et remise en état d''un bloc sanitaire.', array['sanitaire', 'wc'], 'per_unit', null, 80),
    ('nettoyage', 'net_cuisine_professionnelle', 'Nettoyage de cuisine professionnelle', 'nettoyage_specifique', 'm2', 8.00, 12.00, 18.00, 'Dégraissage des surfaces, hottes et équipements de cuisine.', array['cuisine pro', 'dégraissage'], 'finished_surface', null, 90),
    ('nettoyage', 'net_vitrerie_interieur', 'Nettoyage de vitrerie intérieure', 'nettoyage_vitrerie', 'm2', 3.00, 5.00, 8.00, 'Lavage des vitrages accessibles depuis l''intérieur.', array['vitre', 'vitrerie'], 'finished_surface', null, 100),
    ('nettoyage', 'net_vitrerie_deux_faces', 'Nettoyage de vitrerie deux faces', 'nettoyage_vitrerie', 'm2', 5.00, 8.00, 12.00, 'Lavage des deux faces des vitrages accessibles de plain-pied.', array['deux faces'], 'finished_surface', null, 110),
    ('nettoyage', 'net_vitrerie_hauteur', 'Nettoyage de vitrerie en hauteur', 'nettoyage_vitrerie', 'm2', 12.00, 18.00, 26.00, 'Vitrage en hauteur avec perche télescopique ou nacelle.', array['hauteur', 'perche', 'nacelle'], 'finished_surface', null, 120),
    ('nettoyage', 'net_chassis_encadrement', 'Nettoyage des châssis et encadrements', 'nettoyage_vitrerie', 'ml', 4.00, 6.00, 9.00, 'Nettoyage des dormants, ouvrants et rails.', array['châssis', 'encadrement'], 'finished_surface', null, 130),
    ('nettoyage', 'net_facade_vitree', 'Nettoyage de façade vitrée', 'nettoyage_vitrerie', 'm2', 8.00, 12.00, 18.00, 'Lavage de grandes surfaces vitrées avec eau osmosée.', array['façade vitrée', 'mur rideau'], 'finished_surface', 'facade', 140),
    ('nettoyage', 'net_moquette_injection', 'Nettoyage de moquette par injection-extraction', 'nettoyage_specifique', 'm2', 5.00, 8.00, 12.00, 'Shampooinage en profondeur avec extraction et séchage.', array['moquette', 'injection extraction'], 'finished_surface', 'floor', 150),
    ('nettoyage', 'net_decapage_sol', 'Décapage et remise en cire', 'nettoyage_specifique', 'm2', 6.00, 9.00, 14.00, 'Décapage du sol protégé puis application d''une nouvelle émulsion.', array['décapage', 'cire', 'métallisation'], 'finished_surface', 'floor', 160),
    ('nettoyage', 'net_cristallisation_marbre', 'Cristallisation de marbre', 'nettoyage_specifique', 'm2', 18.00, 26.00, 38.00, 'Traitement mécanique redonnant brillance et dureté à la pierre.', array['cristallisation', 'marbre'], 'finished_surface', 'floor', 170),
    ('nettoyage', 'net_desinfection', 'Désinfection des surfaces de contact', 'nettoyage_specifique', 'm2', 3.00, 5.00, 8.00, 'Application d''un désinfectant homologué sur les points de contact.', array['désinfection'], 'finished_surface', null, 180),
    ('nettoyage', 'net_apres_sinistre', 'Nettoyage après sinistre', 'nettoyage_specifique', 'm2', 12.00, 18.00, 28.00, 'Remise en état après dégât des eaux, incendie ou insalubrité.', array['sinistre', 'après incendie'], 'finished_surface', null, 190),
    ('nettoyage', 'net_remise_en_etat_logement', 'Remise en état d''un logement', 'nettoyage_specifique', 'm2', 8.00, 12.00, 18.00, 'Nettoyage complet avant état des lieux ou remise en location.', array['remise en état', 'état des lieux'], 'finished_surface', null, 200),
    ('nettoyage', 'net_debarras', 'Débarras et évacuation', 'depose_evacuation', 'forfait', 180.00, 280.00, 420.00, 'Enlèvement des encombrants et mise en déchetterie.', array['débarras', 'encombrants'], 'per_unit', null, 210),
    ('nettoyage', 'net_entretien_hebdomadaire', 'Entretien hebdomadaire', 'entretien_recurrent', 'h', 32.00, 40.00, 50.00, 'Prestation récurrente hebdomadaire selon cahier des charges.', array['hebdomadaire', 'contrat'], 'per_unit', null, 220),
    ('nettoyage', 'net_entretien_mensuel', 'Entretien mensuel', 'entretien_recurrent', 'h', 34.00, 42.00, 52.00, 'Prestation récurrente mensuelle selon cahier des charges.', array['mensuel'], 'per_unit', null, 230),
    ('nettoyage', 'net_parties_communes', 'Entretien de parties communes', 'entretien_recurrent', 'm2', 2.00, 3.50, 5.00, 'Entretien périodique des halls, couloirs et escaliers.', array['parties communes', 'immeuble'], 'finished_surface', null, 240),
    ('nettoyage', 'net_consommables', 'Fourniture de consommables', 'other', 'forfait', 25.00, 45.00, 75.00, 'Papier, savon et sacs fournis pour la période convenue.', array['consommables'], 'per_unit', null, 250),
    ('nettoyage', 'net_deplacement', 'Forfait de déplacement', 'other', 'forfait', 25.00, 40.00, 60.00, 'Déplacement facturé pour les interventions ponctuelles.', array['déplacement'], 'per_unit', null, 260),
    ('nettoyage', 'net_main_oeuvre', 'Main-d''œuvre agent d''entretien', 'other', 'h', 28.00, 35.00, 44.00, 'Intervention facturée à l''heure hors contrat récurrent.', array[]::text[], 'per_unit', null, 270),
    -- paysagiste
    ('paysagiste', 'pay_protection_abords', 'Protection des abords', 'protection_chantier', 'forfait', 60.00, 100.00, 160.00, 'Protection des accès, des façades et du mobilier extérieur.', array['protection'], 'per_unit', null, 20),
    ('paysagiste', 'pay_debroussaillage', 'Débroussaillage', 'preparation_terrain', 'm2', 2.00, 3.50, 6.00, 'Fauchage et retrait de la végétation spontanée.', array['débroussaillage', 'friche'], 'finished_surface', null, 30),
    ('paysagiste', 'pay_dessouchage', 'Dessouchage', 'depose_evacuation', 'qty', 120.00, 200.00, 320.00, 'Extraction ou rognage d''une souche et comblement.', array['dessouchage', 'souche'], 'per_unit', null, 40),
    ('paysagiste', 'pay_evacuation_vegetaux', 'Évacuation des déchets verts', 'depose_evacuation', 'forfait', 120.00, 200.00, 320.00, 'Chargement et évacuation en centre de compostage.', array['déchets verts', 'évacuation'], 'per_unit', null, 50),
    ('paysagiste', 'pay_terrassement_leger', 'Terrassement léger et nivellement', 'preparation_terrain', 'm2', 8.00, 12.00, 18.00, 'Décaissement, réglage et compactage du terrain.', array['terrassement', 'nivellement'], 'finished_surface', null, 60),
    ('paysagiste', 'pay_apport_terre', 'Apport de terre végétale', 'preparation_terrain', 'm3', 55.00, 78.00, 105.00, 'Fourniture, mise en place et régalage de terre végétale.', array['terre végétale', 'terreau'], 'finished_surface', null, 70),
    ('paysagiste', 'pay_geotextile', 'Pose de géotextile', 'preparation_terrain', 'm2', 4.00, 6.00, 9.00, 'Pose d''un feutre anti-repousse sous massif ou allée.', array['géotextile', 'anti-repousse'], 'finished_surface', null, 80),
    ('paysagiste', 'pay_gazon_semis', 'Engazonnement par semis', 'engazonnement', 'm2', 4.00, 6.00, 9.00, 'Préparation du lit de semence, semis et roulage.', array['semis', 'gazon'], 'finished_surface', null, 90),
    ('paysagiste', 'pay_gazon_plaque', 'Pose de gazon en plaques', 'engazonnement', 'm2', 9.00, 13.00, 18.00, 'Fourniture et pose de rouleaux de gazon avec arrosage initial.', array['gazon en plaques', 'rouleau'], 'finished_surface', null, 100),
    ('paysagiste', 'pay_gazon_synthetique', 'Pose de gazon synthétique', 'engazonnement', 'm2', 38.00, 52.00, 70.00, 'Préparation du support, pose et lestage du gazon synthétique.', array['synthétique'], 'finished_surface', null, 110),
    ('paysagiste', 'pay_plantation_arbuste', 'Plantation d''un arbuste', 'plantation', 'qty', 25.00, 40.00, 60.00, 'Fosse, amendement, plantation et arrosage d''un arbuste.', array['arbuste', 'plantation'], 'per_unit', null, 120),
    ('paysagiste', 'pay_plantation_arbre', 'Plantation d''un arbre', 'plantation', 'qty', 120.00, 190.00, 290.00, 'Fosse profonde, tuteurage et arrosage d''un arbre tige.', array['arbre', 'tige'], 'per_unit', null, 130),
    ('paysagiste', 'pay_haie_plantation', 'Plantation de haie', 'plantation', 'ml', 28.00, 40.00, 58.00, 'Tranchée, amendement et plantation en ligne.', array['haie'], 'finished_surface', null, 140),
    ('paysagiste', 'pay_massif', 'Création d''un massif paysager', 'plantation', 'm2', 45.00, 65.00, 90.00, 'Dessin, préparation, plantation et paillage d''un massif.', array['massif'], 'finished_surface', null, 150),
    ('paysagiste', 'pay_paillage', 'Paillage des massifs', 'plantation', 'm2', 6.00, 9.00, 14.00, 'Fourniture et étalement d''un paillage minéral ou organique.', array['paillage', 'écorces'], 'finished_surface', null, 160),
    ('paysagiste', 'pay_bordure', 'Pose de bordures', 'terrasse_allee', 'ml', 22.00, 32.00, 45.00, 'Pose sur lit de béton de bordures béton, pierre ou acier.', array['bordure'], 'finished_surface', null, 170),
    ('paysagiste', 'pay_allee_gravier', 'Création d''une allée en gravier', 'terrasse_allee', 'm2', 32.00, 45.00, 62.00, 'Décaissement, fondation, géotextile et gravier compacté.', array['allée', 'gravier'], 'finished_surface', null, 180),
    ('paysagiste', 'pay_terrasse_dalles', 'Terrasse en dalles sur lit de sable', 'terrasse_allee', 'm2', 55.00, 75.00, 100.00, 'Fondation, lit de pose et pose de dalles avec joints.', array['dalles', 'terrasse'], 'finished_surface', 'floor', 190),
    ('paysagiste', 'pay_paves', 'Pose de pavés', 'terrasse_allee', 'm2', 65.00, 88.00, 120.00, 'Fondation, pose des pavés, jointoiement et compactage.', array['pavé', 'klinker'], 'finished_surface', 'floor', 200),
    ('paysagiste', 'pay_cloture_grillage', 'Pose de clôture grillagée', 'cloture_portail', 'ml', 38.00, 55.00, 78.00, 'Scellement des poteaux et pose du grillage rigide ou souple.', array['clôture', 'grillage'], 'finished_surface', null, 210),
    ('paysagiste', 'pay_cloture_panneaux', 'Pose de panneaux occultants', 'cloture_portail', 'ml', 65.00, 90.00, 125.00, 'Poteaux scellés et panneaux bois ou composite.', array['occultant', 'panneau', 'brise-vue'], 'finished_surface', null, 220),
    ('paysagiste', 'pay_portail', 'Pose d''un portail', 'cloture_portail', 'qty', 450.00, 650.00, 920.00, 'Scellement des piliers, pose et réglage du portail.', array['portail'], 'per_unit', null, 230),
    ('paysagiste', 'pay_arrosage_automatique', 'Installation d''arrosage automatique', 'arrosage', 'm2', 12.00, 18.00, 26.00, 'Tranchées, réseau, tuyères et programmateur.', array['arrosage automatique', 'tuyère'], 'finished_surface', null, 240),
    ('paysagiste', 'pay_recuperateur_eau', 'Pose d''un récupérateur d''eau', 'arrosage', 'qty', 320.00, 460.00, 650.00, 'Fourniture et raccordement d''une cuve de récupération.', array['récupérateur', 'cuve'], 'per_unit', null, 250),
    ('paysagiste', 'pay_taille_haie', 'Taille de haie', 'entretien_jardin', 'ml', 4.00, 6.00, 10.00, 'Taille des faces et du dessus, évacuation des déchets comprise.', array['taille haie'], 'finished_surface', null, 260),
    ('paysagiste', 'pay_tonte', 'Tonte de pelouse', 'entretien_jardin', 'm2', 0.35, 0.55, 0.85, 'Tonte, finitions aux abords et ramassage.', array['tonte', 'pelouse'], 'finished_surface', null, 270),
    ('paysagiste', 'pay_entretien_annuel', 'Contrat d''entretien annuel', 'entretien_jardin', 'forfait', 480.00, 750.00, 1100.00, 'Passages programmés sur l''année selon un cahier des charges.', array['contrat', 'entretien annuel'], 'per_unit', null, 280),
    ('paysagiste', 'pay_elagage', 'Élagage d''un arbre', 'elagage_abattage', 'qty', 180.00, 280.00, 420.00, 'Taille de réduction ou d''éclaircie avec évacuation des branches.', array['élagage', 'taille arbre'], 'per_unit', null, 290),
    ('paysagiste', 'pay_abattage', 'Abattage d''un arbre', 'elagage_abattage', 'qty', 250.00, 400.00, 620.00, 'Abattage sécurisé, démontage par sections si nécessaire.', array['abattage'], 'per_unit', null, 300),
    ('paysagiste', 'pay_main_oeuvre', 'Main-d''œuvre jardinier-paysagiste', 'other', 'h', 38.00, 48.00, 60.00, 'Intervention facturée à l''heure pour les travaux hors forfait.', array[]::text[], 'per_unit', null, 310),
    -- ramoneur
    ('ramoneur', 'ram_protection_interieur', 'Protection de l''intérieur', 'protection_chantier', 'forfait', 20.00, 35.00, 55.00, 'Bâchage et aspiration pour éviter toute salissure dans le logement.', array['protection'], 'per_unit', null, 20),
    ('ramoneur', 'ram_ramonage_simple', 'Ramonage d''un conduit', 'ramonage', 'qty', 65.00, 90.00, 125.00, 'Ramonage mécanique d''un conduit avec certificat.', array['ramonage', 'conduit', 'cheminée'], 'per_unit', null, 30),
    ('ramoneur', 'ram_ramonage_double', 'Ramonage de deux conduits', 'ramonage', 'qty', 110.00, 150.00, 210.00, 'Ramonage de deux conduits lors d''un même passage.', array['deux conduits'], 'per_unit', null, 40),
    ('ramoneur', 'ram_ramonage_mecanique', 'Ramonage mécanique renforcé', 'ramonage', 'qty', 120.00, 170.00, 240.00, 'Ramonage rotatif pour conduit fortement encrassé.', array['rotatif', 'renforcé'], 'per_unit', null, 50),
    ('ramoneur', 'ram_debistrage', 'Débistrage de conduit', 'ramonage', 'ml', 85.00, 120.00, 175.00, 'Élimination mécanique du bistre durci dans le conduit.', array['débistrage', 'bistre'], 'finished_surface', null, 60),
    ('ramoneur', 'ram_tubage', 'Tubage d''un conduit', 'ramonage', 'ml', 95.00, 135.00, 190.00, 'Fourniture et mise en place d''un tubage inox flexible ou rigide.', array['tubage', 'gainage'], 'finished_surface', null, 70),
    ('ramoneur', 'ram_chapeau_conduit', 'Pose d''un chapeau de conduit', 'ramonage', 'qty', 120.00, 180.00, 260.00, 'Fourniture et pose d''un chapeau ou aspirateur statique.', array['chapeau', 'mitre'], 'per_unit', null, 80),
    ('ramoneur', 'ram_entretien_chaudiere_gaz', 'Entretien d''une chaudière gaz', 'entretien_chauffage', 'qty', 110.00, 150.00, 200.00, 'Démontage, nettoyage, contrôle et remise en service.', array['chaudière gaz', 'entretien'], 'per_unit', null, 90),
    ('ramoneur', 'ram_entretien_chaudiere_mazout', 'Entretien d''une chaudière mazout', 'entretien_chauffage', 'qty', 140.00, 190.00, 250.00, 'Nettoyage du foyer, remplacement du gicleur et réglage.', array['mazout', 'fuel'], 'per_unit', null, 100),
    ('ramoneur', 'ram_entretien_poele_bois', 'Entretien d''un poêle à bois', 'entretien_chauffage', 'qty', 85.00, 120.00, 165.00, 'Nettoyage complet, contrôle des joints et de la vitre.', array['poêle à bois', 'insert'], 'per_unit', null, 110),
    ('ramoneur', 'ram_entretien_pellets', 'Entretien d''un poêle à pellets', 'entretien_chauffage', 'qty', 120.00, 165.00, 220.00, 'Nettoyage du creuset, des échangeurs et du conduit de fumée.', array['pellets', 'granulés'], 'per_unit', null, 120),
    ('ramoneur', 'ram_entretien_pompe_chaleur', 'Entretien d''une pompe à chaleur', 'entretien_chauffage', 'qty', 140.00, 190.00, 260.00, 'Contrôle du circuit, nettoyage des échangeurs et vérification des pressions.', array['pompe à chaleur', 'PAC'], 'per_unit', null, 130),
    ('ramoneur', 'ram_desembouage', 'Désembouage du circuit de chauffage', 'entretien_chauffage', 'forfait', 480.00, 700.00, 980.00, 'Nettoyage hydrodynamique du réseau et ajout d''inhibiteur.', array['désembouage'], 'per_unit', null, 140),
    ('ramoneur', 'ram_purge_radiateurs', 'Purge des radiateurs', 'entretien_chauffage', 'qty', 12.00, 20.00, 32.00, 'Purge et remise en pression de l''installation.', array['purge', 'radiateur'], 'per_unit', null, 150),
    ('ramoneur', 'ram_certificat', 'Certificat de ramonage', 'controle_conformite', 'qty', 15.00, 25.00, 40.00, 'Délivrance du certificat exigé par l''assurance.', array['certificat', 'attestation'], 'per_unit', null, 160),
    ('ramoneur', 'ram_controle_combustion', 'Contrôle de combustion et attestation', 'controle_conformite', 'qty', 65.00, 95.00, 135.00, 'Mesures de combustion et délivrance de l''attestation réglementaire.', array['contrôle combustion'], 'per_unit', null, 170),
    ('ramoneur', 'ram_controle_etancheite_gaz', 'Contrôle d''étanchéité gaz', 'controle_conformite', 'forfait', 95.00, 140.00, 195.00, 'Vérification de l''étanchéité de l''installation gaz et rapport.', array['étanchéité gaz'], 'per_unit', null, 180),
    ('ramoneur', 'ram_analyse_fumees', 'Analyse des fumées', 'controle_conformite', 'qty', 45.00, 70.00, 100.00, 'Mesure du rendement et des émissions avec impression du relevé.', array['analyse fumées'], 'per_unit', null, 190),
    ('ramoneur', 'ram_depannage_urgence', 'Dépannage en urgence', 'depannage', 'h', 65.00, 90.00, 125.00, 'Intervention prioritaire hors entretien programmé.', array['dépannage', 'urgence'], 'per_unit', null, 200),
    ('ramoneur', 'ram_remplacement_piece', 'Remplacement de pièce', 'depannage', 'qty', 45.00, 75.00, 120.00, 'Remplacement d''un organe défectueux hors garantie.', array['pièce', 'remplacement'], 'per_unit', null, 210),
    ('ramoneur', 'ram_deplacement', 'Forfait de déplacement', 'other', 'forfait', 25.00, 45.00, 70.00, 'Déplacement facturé pour les interventions ponctuelles.', array['déplacement'], 'per_unit', null, 220),
    ('ramoneur', 'ram_main_oeuvre', 'Main-d''œuvre technicien', 'other', 'h', 48.00, 62.00, 78.00, 'Intervention facturée à l''heure pour les travaux hors forfait.', array[]::text[], 'per_unit', null, 230)
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
-- 5. Mise a niveau des catalogues deja copies
-- ---------------------------------------------------------------------------
-- Une entreprise ayant deja active un metier ne voit pas les prestations
-- ajoutees apres coup. Ces deux fonctions le lui proposent explicitement,
-- sans jamais ecraser ce qu'elle a modifie.

create or replace function public.count_missing_trade_services()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.company_trades link
  join public.trade_service_templates template
    on template.trade_id = link.trade_id
   and template.is_active
  where link.company_id = public.resolve_user_company(auth.uid())
    and not exists (
      select 1
      from public.service_catalog existing
      where existing.company_id = link.company_id
        and (
          existing.default_metadata ->> 'default_catalog_key' = template.catalog_key
          or lower(btrim(existing.name)) = lower(btrim(template.name))
        )
    );
$$;

create or replace function public.sync_company_trade_catalogs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_link record;
  v_added integer;
  v_total integer := 0;
begin
  if v_user_id is null then
    raise exception 'Utilisateur non connecte.' using errcode = '42501';
  end if;

  v_company_id := public.resolve_user_company(v_user_id);
  if v_company_id is null then
    raise exception 'Entreprise introuvable.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('company-trade:' || v_company_id::text, 0)
  );

  for v_link in
    select trade_id from public.company_trades where company_id = v_company_id
  loop
    v_added := public.copy_trade_services_to_company(
      v_user_id, v_company_id, v_link.trade_id
    );
    v_total := v_total + v_added;
  end loop;

  return jsonb_build_object('services_added', v_total);
end;
$$;

revoke all on function public.count_missing_trade_services() from public, anon;
revoke all on function public.sync_company_trade_catalogs() from public, anon;
grant execute on function public.count_missing_trade_services() to authenticated;
grant execute on function public.sync_company_trade_catalogs() to authenticated;

comment on function public.count_missing_trade_services() is
  'Nombre de prestations types absentes du catalogue, pour les metiers actifs.';
comment on function public.sync_company_trade_catalogs() is
  'Ajoute les prestations types manquantes des metiers actifs. N''ecrase jamais une prestation existante.';

commit;
