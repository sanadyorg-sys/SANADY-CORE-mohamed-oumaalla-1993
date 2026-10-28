-- Reads a rate-limit counter without adding to it, so that sign-in can count
-- failed attempts only: a counter is checked before the attempt and consumed
-- only when the password is wrong. Server-only (service role), like
-- consume_rate_limit.

create function public.rate_limit_reached(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select rl.hits >= p_limit
      from private.rate_limits rl
     where rl.key = p_key and rl.window_started_at >= now() - make_interval(secs => p_window_seconds)
  ), false);
$$;
revoke execute on function public.rate_limit_reached(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_reached(text, integer, integer) to service_role;
