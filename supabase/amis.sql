-- Carnet de préfectures : amis (à exécuter UNE fois, après schema.sql)
--
--   Supabase > SQL Editor > New query : coller ce fichier entier, puis Run.
--   Le fichier peut être relancé sans risque.
--
-- Principe de confidentialité :
--   * chacun a un pseudo et un code ami (8 caractères) à communiquer soi-même ;
--   * une demande d'ami doit être ACCEPTÉE avant que quiconque voie un carnet ;
--   * un ami voit les lieux, dates, notes et photos en LECTURE SEULE, rien d'autre
--     (jamais l'e-mail) ; retirer un ami coupe immédiatement l'accès ;
--   * la table visits n'est pas modifiée : toute la lecture « ami » passe par les
--     fonctions ci-dessous, qui vérifient l'amitié acceptée côté serveur.

create table if not exists public.profiles (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  pseudo     text not null check (char_length(pseudo) between 2 and 20),
  code       text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_pseudo_lower on public.profiles (lower(pseudo));

create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

-- Aucune écriture directe : tout passe par les fonctions (security definer).
alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "friendships_select_own" on public.friendships;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "friendships_select_own" on public.friendships
  for select to authenticated using (auth.uid() = requester or auth.uid() = addressee);

-- ---------- fonctions ----------

create or replace function public.are_friends(other uuid) returns boolean
language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = auth.uid() and f.addressee = other)
        or (f.addressee = auth.uid() and f.requester = other)));
$$;

create or replace function public.my_profile() returns json
language sql security definer set search_path = public stable as $$
  select json_build_object('pseudo', p.pseudo, 'code', p.code)
  from public.profiles p where p.user_id = auth.uid();
$$;

create or replace function public.set_profile(p_pseudo text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid      uuid := auth.uid();
  clean    text := btrim(regexp_replace(coalesce(p_pseudo, ''), '\s+', ' ', 'g'));
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- sans 0/O, 1/I/L
  new_code text;
  i        int;
begin
  if uid is null then raise exception 'non_connecte'; end if;
  if char_length(clean) < 2 or char_length(clean) > 20 or clean !~ '^[[:alnum:] _.-]+$' then
    raise exception 'pseudo_invalide';
  end if;
  if exists (select 1 from public.profiles p where lower(p.pseudo) = lower(clean) and p.user_id <> uid) then
    raise exception 'pseudo_pris';
  end if;
  if exists (select 1 from public.profiles p where p.user_id = uid) then
    update public.profiles p set pseudo = clean where p.user_id = uid;
  else
    loop
      new_code := '';
      for i in 1..8 loop
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.profiles p where p.code = new_code);
    end loop;
    insert into public.profiles (user_id, pseudo, code) values (uid, clean, new_code);
  end if;
  return (select json_build_object('pseudo', p.pseudo, 'code', p.code) from public.profiles p where p.user_id = uid);
end $$;

create or replace function public.request_friend(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  uid    uuid := auth.uid();
  c      text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  target uuid;
  tname  text;
  f      public.friendships;
begin
  if uid is null then raise exception 'non_connecte'; end if;
  if not exists (select 1 from public.profiles p where p.user_id = uid) then raise exception 'profil_requis'; end if;
  select p.user_id, p.pseudo into target, tname from public.profiles p where p.code = c;
  if target is null then raise exception 'code_inconnu'; end if;
  if target = uid then raise exception 'soi_meme'; end if;
  select * into f from public.friendships x
   where least(x.requester, x.addressee) = least(uid, target)
     and greatest(x.requester, x.addressee) = greatest(uid, target);
  if found then
    if f.status = 'accepted' then return json_build_object('result', 'deja_ami', 'pseudo', tname); end if;
    if f.requester = uid then return json_build_object('result', 'deja_envoyee', 'pseudo', tname); end if;
    update public.friendships x set status = 'accepted' where x.id = f.id;     -- demande croisée : on accepte
    return json_build_object('result', 'accepte', 'pseudo', tname);
  end if;
  insert into public.friendships (requester, addressee) values (uid, target);
  return json_build_object('result', 'envoyee', 'pseudo', tname);
end $$;

create or replace function public.respond_friend(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships f set status = 'accepted'
     where f.id = p_id and f.addressee = auth.uid() and f.status = 'pending';
  else
    delete from public.friendships f
     where f.id = p_id and f.addressee = auth.uid() and f.status = 'pending';
  end if;
end $$;

-- Retire un ami, refuse ou annule une demande : même geste.
create or replace function public.remove_friend(p_user uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friendships f
   where (f.requester = auth.uid() and f.addressee = p_user)
      or (f.addressee = auth.uid() and f.requester = p_user);
$$;

create or replace function public.friend_requests() returns json
language sql security definer set search_path = public stable as $$
  select coalesce(json_agg(json_build_object(
           'id', f.id,
           'direction', case when f.addressee = auth.uid() then 'in' else 'out' end,
           'user_id', o.user_id, 'pseudo', o.pseudo, 'created_at', f.created_at)
         order by f.created_at desc), '[]'::json)
  from public.friendships f
  join public.profiles o on o.user_id = case when f.addressee = auth.uid() then f.requester else f.addressee end
  where f.status = 'pending' and (f.requester = auth.uid() or f.addressee = auth.uid());
$$;

-- Classement : soi-même + amis acceptés, avec le nombre de lieux visités.
create or replace function public.friends_overview() returns json
language sql security definer set search_path = public stable as $$
  select coalesce(json_agg(r order by r.n desc, lower(r.pseudo)), '[]'::json)
  from (
    select p.user_id, p.pseudo, (p.user_id = auth.uid()) as is_me,
           (select count(*)::int from public.visits v where v.user_id = p.user_id and not v.deleted) as n
    from public.profiles p
    where p.user_id = auth.uid() or public.are_friends(p.user_id)
  ) r;
$$;

-- Carnet d'un ami (sans les photos, qui sont lourdes : elles se chargent une à une).
create or replace function public.friend_visits(p_friend uuid) returns json
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.are_friends(p_friend) then raise exception 'non_ami'; end if;
  return (select coalesce(json_agg(json_build_object(
            'place_id', v.place_id, 'date', v.date, 'note', v.note, 'has_photo', v.photo is not null)
          order by v.date, v.place_id), '[]'::json)
          from public.visits v where v.user_id = p_friend and not v.deleted);
end $$;

create or replace function public.friend_photo(p_friend uuid, p_place text) returns text
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.are_friends(p_friend) then raise exception 'non_ami'; end if;
  return (select v.photo from public.visits v
          where v.user_id = p_friend and v.place_id = p_place and not v.deleted);
end $$;

-- Seuls les comptes connectés peuvent appeler ces fonctions.
revoke all on function public.are_friends(uuid), public.my_profile(), public.set_profile(text),
  public.request_friend(text), public.respond_friend(uuid, boolean), public.remove_friend(uuid),
  public.friend_requests(), public.friends_overview(), public.friend_visits(uuid),
  public.friend_photo(uuid, text) from public, anon;
grant execute on function public.are_friends(uuid), public.my_profile(), public.set_profile(text),
  public.request_friend(text), public.respond_friend(uuid, boolean), public.remove_friend(uuid),
  public.friend_requests(), public.friends_overview(), public.friend_visits(uuid),
  public.friend_photo(uuid, text) to authenticated;
