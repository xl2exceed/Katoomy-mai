-- Ensure the business-assets storage bucket exists and is marked public
-- so that getPublicUrl() returns accessible URLs for logos and other assets.

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-assets', 'business-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;
