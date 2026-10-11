-- Prevent authenticated users from self-approving or modifying audit-sensitive profile fields.
-- Profile rows are created by the trusted auth.users trigger; clients may only edit
-- ordinary profile presentation/contact fields.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, updated_at) ON TABLE public.profiles TO authenticated;
