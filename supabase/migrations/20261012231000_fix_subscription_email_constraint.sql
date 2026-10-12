
alter table public.association_subscriptions
  drop constraint if exists association_subscriptions_email_format;

alter table public.association_subscriptions
  add constraint association_subscriptions_email_format
  check (billing_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$');
