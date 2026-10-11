INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-avatars', 'profile-avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "platform admins upload profile avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-avatars' AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'platform_admin'));

CREATE POLICY "platform admins delete profile avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-avatars' AND EXISTS (SELECT 1 FROM public.user_roles AS ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'platform_admin'));
