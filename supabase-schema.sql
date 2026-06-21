-- AnalisiEBusinessPlan.it — Schema Supabase
-- Esegui questo file nel SQL Editor di Supabase (supabase.com → SQL Editor → New query)

-- 1. PROFILI UTENTI (estende auth.users di Supabase)
create table if not exists public.profili (
  id           uuid references auth.users(id) on delete cascade primary key,
  nome         text,
  cognome      text,
  email        text,
  studio       text,
  piva         text,
  sdi          text,
  indirizzo    text,
  citta        text,
  cap          text,
  provincia    text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- 2. ORDINI
create table if not exists public.ordini (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  prodotto     text not null,
  importo      numeric(10,2) not null,
  importo_iva  numeric(10,2),
  stato        text default 'completato' check (stato in ('completato','in_elaborazione','errore','rimborsato')),
  stripe_id    text,
  report_url   text,
  created_at   timestamptz default now()
);

-- 3. FATTURE
create table if not exists public.fatture (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade,
  ordine_id    uuid references public.ordini(id),
  numero       text not null,
  importo      numeric(10,2) not null,
  importo_iva  numeric(10,2),
  pdf_url      text,
  sdi_stato    text default 'da_emettere' check (sdi_stato in ('da_emettere','inviata','accettata','scartata')),
  created_at   timestamptz default now()
);

-- 4. ROW LEVEL SECURITY — ogni utente vede solo i propri dati
alter table public.profili  enable row level security;
alter table public.ordini   enable row level security;
alter table public.fatture  enable row level security;

create policy "Utente vede solo il suo profilo"
  on public.profili for all using (auth.uid() = id);

create policy "Utente vede solo i suoi ordini"
  on public.ordini for all using (auth.uid() = user_id);

create policy "Utente vede solo le sue fatture"
  on public.fatture for all using (auth.uid() = user_id);

-- 5. TRIGGER: crea profilo automaticamente alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profili (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
