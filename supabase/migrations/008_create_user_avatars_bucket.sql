-- =====================================================
-- 创建用户头像存储桶
-- =====================================================

-- 创建用户头像存储桶
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

-- 设置存储桶的RLS策略
CREATE POLICY "用户可以查看所有头像"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'user-avatars');

CREATE POLICY "用户只能上传自己的头像"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (regexp_split_to_array((storage.filename(name)), '-'))[1]
);

CREATE POLICY "用户只能更新自己的头像"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (regexp_split_to_array((storage.filename(name)), '-'))[1]
);

CREATE POLICY "用户只能删除自己的头像"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars' 
  AND (storage.foldername(name))[1] = 'avatars'
  AND auth.uid()::text = (regexp_split_to_array((storage.filename(name)), '-'))[1]
);