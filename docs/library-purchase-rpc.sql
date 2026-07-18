-- Run this once in your SQL editor.
-- Adds a database RPC that lets the browser purchase a library book
-- directly, so buying books works even when the site is served from
-- Vercel / a static host (no TanStack server functions available).
--
-- Security: SECURITY DEFINER runs as the function owner but we still check
-- auth.uid() so unauthenticated calls are rejected.

create or replace function public.purchase_library_book(_book_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_admin boolean := false;
  book_row record;
  buyer_row record;
  new_balance numeric;
  price numeric;
begin
  if uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select id, title, coalesce(price_credits, 0)::numeric as price_credits, read_url
    into book_row
  from public.library_books
  where id = _book_id;

  if not found then
    raise exception 'Book not found';
  end if;

  price := book_row.price_credits;
  select public.has_role(uid, 'admin'::app_role) into is_admin;

  if not is_admin and price > 0 then
    select email_verified into buyer_row from public.profiles where id = uid;
    if not coalesce(buyer_row.email_verified, false) then
      raise exception 'EMAIL_NOT_VERIFIED';
    end if;
  end if;

  -- Idempotent: if the user already owns it, return.
  if exists (
    select 1 from public.library_book_purchases
    where book_id = _book_id and user_id = uid
  ) then
    return jsonb_build_object('ok', true, 'already_owned', true, 'read_url', book_row.read_url);
  end if;

  insert into public.library_book_purchases (book_id, user_id, price_paid)
  values (_book_id, uid, case when is_admin then 0 else price end)
  on conflict (book_id, user_id) do nothing;

  if not exists (
    select 1 from public.library_book_purchases
    where book_id = _book_id and user_id = uid
  ) then
    return jsonb_build_object('ok', true, 'already_owned', true, 'read_url', book_row.read_url);
  end if;

  if price > 0 and not is_admin then
    select credits into buyer_row from public.profiles where id = uid for update;
    if coalesce(buyer_row.credits, 0) < price then
      delete from public.library_book_purchases where book_id = _book_id and user_id = uid;
      raise exception 'INSUFFICIENT_CREDITS';
    end if;
    new_balance := round((coalesce(buyer_row.credits, 0) - price)::numeric, 2);
    update public.profiles set credits = new_balance where id = uid;

    insert into public.credit_transactions (user_id, amount, reason, metadata, balance_after)
    values (uid, -price, 'library_book_purchase',
            jsonb_build_object('book_id', _book_id, 'title', book_row.title),
            new_balance);
  end if;

  return jsonb_build_object('ok', true, 'already_owned', false, 'read_url', book_row.read_url);
end;
$$;

grant execute on function public.purchase_library_book(uuid) to authenticated;
