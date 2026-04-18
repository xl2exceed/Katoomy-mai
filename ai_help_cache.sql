-- Migration: Create AI Help Cache Table
-- This table stores cached responses from the AI help assistant to save tokens and improve response time.

CREATE TABLE IF NOT EXISTS public.ai_help_cache (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    question TEXT NOT NULL,
    normalized_question TEXT NOT NULL, -- Lowercase, punctuation removed for better matching
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    use_count INTEGER DEFAULT 1 NOT NULL
);

-- Create an index on the normalized question for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_help_cache_normalized_question ON public.ai_help_cache(normalized_question);

-- Set up Row Level Security (RLS)
ALTER TABLE public.ai_help_cache ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read from the cache
CREATE POLICY "Allow authenticated users to read ai_help_cache"
    ON public.ai_help_cache
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow authenticated users to insert into the cache
CREATE POLICY "Allow authenticated users to insert ai_help_cache"
    ON public.ai_help_cache
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow authenticated users to update the cache (for use_count and last_used_at)
CREATE POLICY "Allow authenticated users to update ai_help_cache"
    ON public.ai_help_cache
    FOR UPDATE
    TO authenticated
    USING (true);
