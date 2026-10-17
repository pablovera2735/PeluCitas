-- PeluCitas: ampliación segura de la BD existente.
-- Ejecutar en Supabase > SQL Editor, UNA VEZ o de nuevo si necesitas actualizar las políticas.
-- NO elimina ni recrea public.appointments ni borra reservas existentes.

begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Los usuarios pueden consultar su propio estado de administrador,
-- pero desde la app NO pueden asignarse ni quitarse permisos.
revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

drop policy if exists "Consultar mi rol de administrador" on public.admin_users;
create policy "Consultar mi rol de administrador"
  on public.admin_users for select to authenticated
  using (user_id = (select auth.uid()));

-- Conservar las reglas actuales de cliente y agregar permiso extra al administrador.
alter table public.appointments enable row level security;
grant select, delete on table public.appointments to authenticated;

drop policy if exists "Administrador: ver todas las citas" on public.appointments;
create policy "Administrador: ver todas las citas"
  on public.appointments for select to authenticated
  using (
    exists (
      select 1 from public.admin_users as a
      where a.user_id = (select auth.uid())
    )
  );

drop policy if exists "Administrador: cancelar citas" on public.appointments;
create policy "Administrador: cancelar citas"
  on public.appointments for delete to authenticated
  using (
    exists (
      select 1 from public.admin_users as a
      where a.user_id = (select auth.uid())
    )
  );

commit;

-- AHORA asigna el rol desde el panel SQL Editor con tu propio User UID:
-- insert into public.admin_users (user_id)
-- values ('PEGA_AQUI_EL_USER_UID_DEL_PELUQUERO');
-- IMPORTANTE: sustituye PEGA_AQUI... por el UUID real, SIN la palabra entre comillas.
-- Consulta Authentication > Users > UID. No lo hagas desde la aplicación.
