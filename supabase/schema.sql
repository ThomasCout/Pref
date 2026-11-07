-- Carnet de préfectures : schéma Supabase
--
-- Mise en place (5 minutes) :
--   1. Créer un projet sur https://supabase.com (offre gratuite).
--   2. SQL Editor > New query : coller ce fichier entier, puis Run.
--   3. Authentication > URL Configuration :
--        - Site URL : l'adresse https où l'app est publiée
--          (ex. https://thomascout.github.io/Pref/)
--        - Redirect URLs : ajouter la même adresse.
--   4. Project Settings > API : copier « Project URL » et la clé « anon public »
--      dans SUPABASE_URL et SUPABASE_KEY, en haut du script de index.html.
--      (La clé anon est faite pour être publique : c'est la sécurité par
--      ligne ci-dessous qui protège les données, pas le secret de la clé.)
--   5. Ne jamais mettre la clé « service_role » dans l'application.

create table if not exists public.visits (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  place_id   text not null check (char_length(place_id) <= 64),
  date       date,
  note       text not null default '' check (char_length(note) <= 500),
  -- photo réduite côté app (JPEG 1000 px max), stockée en data URL
  photo      text check (photo is null or (photo like 'data:image/%' and char_length(photo) <= 600000)),
  deleted    boolean not null default false,   -- suppression douce, pour propager les retraits
  client_ts  bigint  not null,                 -- horodatage de la modification (ms), sert au « dernier écrit gagne »
  updated_at timestamptz not null default now(), -- horloge serveur, sert à la récupération incrémentale
  primary key (user_id, place_id),
  check (deleted or date is not null)
);

create index if not exists visits_user_updated_idx on public.visits (user_id, updated_at);

-- Chacun ne voit et ne modifie que ses propres lignes.
alter table public.visits enable row level security;

drop policy if exists "visits_select_own" on public.visits;
drop policy if exists "visits_insert_own" on public.visits;
drop policy if exists "visits_update_own" on public.visits;

create policy "visits_select_own" on public.visits
  for select to authenticated using (auth.uid() = user_id);
create policy "visits_insert_own" on public.visits
  for insert to authenticated with check (auth.uid() = user_id);
create policy "visits_update_own" on public.visits
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- Pas de policy DELETE : les suppressions passent par deleted = true.

-- Dernier écrit gagne, appliqué côté serveur : une modification plus ancienne
-- que celle déjà enregistrée est ignorée. updated_at suit toujours l'horloge serveur.
create or replace function public.visits_touch() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.client_ts < old.client_ts then
    return null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists visits_touch on public.visits;
create trigger visits_touch before insert or update on public.visits
  for each row execute function public.visits_touch();
