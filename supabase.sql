-- PeluCitas: 1 peluquero, citas de una hora, lunes a sábado.
-- Ejecuta este archivo UNA vez en Supabase > SQL Editor.
create table public.appointments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^[+0-9() .-]{7,20}$'),
  service text not null check (service in ('Corte de pelo', 'Arreglo de barba', 'Corte + barba')),
  appointment_date date not null,
  appointment_time time without time zone not null,
  created_at timestamptz not null default now(),
  constraint weekday_appointments check (extract(isodow from appointment_date) between 1 and 6),
  constraint valid_times check (
    (extract(hour from appointment_time) between 9 and 13
     or extract(hour from appointment_time) between 16 and 19)
    and extract(minute from appointment_time) = 0
    and extract(second from appointment_time) = 0
  ),
  constraint no_double_bookings unique (appointment_date, appointment_time)
);

create function public.reject_past_appointments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.appointment_date + new.appointment_time) <= (now() at time zone 'Europe/Madrid') then
    raise exception 'No puedes reservar una cita en el pasado';
  end if;
  return new;
end;
$$;

create trigger appointments_must_be_future
before insert or update on public.appointments
for each row execute function public.reject_past_appointments();

-- Los datos privados se consultan solo por el propietario de la reserva.
alter table public.appointments enable row level security;
revoke all on table public.appointments from anon, authenticated;
grant select, insert, delete on table public.appointments to authenticated;

create policy "Mis reservas: leer"
on public.appointments for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Mis reservas: crear"
on public.appointments for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Mis reservas: cancelar"
on public.appointments for delete to authenticated
using ((select auth.uid()) = user_id);

-- Para comprobar disponibilidad, se publican SOLAMENTE las horas ocupadas.
create function public.get_booked_slots(p_date date)
returns table (slot text)
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(a.appointment_time, 'HH24:MI') as slot
  from public.appointments as a
  where a.appointment_date = p_date;
$$;

revoke all on function public.get_booked_slots(date) from public, anon;
grant execute on function public.get_booked_slots(date) to authenticated;
