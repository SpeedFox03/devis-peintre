begin;

-- Une facture ne doit pas être envoyée deux fois en parallèle ou après un
-- succès. Une nouvelle tentative reste possible après un échec explicite.
create unique index if not exists einvoice_submissions_active_document_unique
  on public.einvoice_submissions (document_id, environment)
  where status not in ('failed', 'rejected', 'no_action_taken');

commit;
