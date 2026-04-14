-- FIX: Improved Semantic Hashing
-- Refines the comment and whitespace stripping logic to be more precise and less aggressive.

SET search_path = public, extensions;

-- 1. Update the Trigger Function with refined regex and safety fallback
CREATE OR REPLACE FUNCTION public.calculate_content_hashes()
RETURNS TRIGGER AS $$
DECLARE
  clean_content TEXT;
BEGIN
  -- Standard Hash (Exact Match)
  NEW.content_hash := encode(extensions.digest(convert_to(NEW.content, 'UTF8'), 'sha256'), 'hex');
  
  -- Semantic Hash (Ignore comments and whitespace to catch logic duplication)
  -- 1. Remove multi-line docstrings (Python) - refined regex
  clean_content := regexp_replace(NEW.content, $re$("{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})$re$, '', 'g');
  -- 2. Remove single-line comments (#)
  clean_content := regexp_replace(clean_content, $re$#.*$re$, '', 'g');
  -- 3. Remove all whitespace
  clean_content := regexp_replace(clean_content, $re$\s+$re$, '', 'g');
  
  -- Safety Fallback: If stripping comments made the string too short, use whitespace-only hash
  IF LENGTH(clean_content) < 10 THEN
     clean_content := regexp_replace(NEW.content, $re$\s+$re$, '', 'g');
  END IF;

  NEW.nowhitespace_hash := encode(extensions.digest(convert_to(clean_content, 'UTF8'), 'sha256'), 'hex');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. TRUNCATE AND BACKFILL existing hashes with the refined logic
-- We do a full update to ensure semantic distinctness for logic-only changes.
UPDATE public.file_snapshots 
SET 
  content_hash = encode(extensions.digest(convert_to(content, 'UTF8'), 'sha256'), 'hex'),
  nowhitespace_hash = encode(
    extensions.digest(
      convert_to(
        CASE 
          WHEN LENGTH(
            regexp_replace(
              regexp_replace(
                regexp_replace(content, $re$("{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})$re$, '', 'g'),
                $re$#.*$re$, '', 'g'
              ),
              $re$\s+$re$, '', 'g'
            )
          ) < 10 THEN regexp_replace(content, $re$\s+$re$, '', 'g')
          ELSE regexp_replace(
            regexp_replace(
              regexp_replace(content, $re$("{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})$re$, '', 'g'),
              $re$#.*$re$, '', 'g'
            ),
            $re$\s+$re$, '', 'g'
          )
        END, 
        'UTF8'
      ), 
      'sha256'
    ), 
    'hex'
  );

-- 3. Re-create views to ensure they use the new logic for filtering
CREATE OR REPLACE VIEW public.starter_file_hashes 
WITH (security_invoker = true)
AS
SELECT DISTINCT
  encode(extensions.digest(convert_to(f->>'content', 'UTF8'), 'sha256'), 'hex') as content_hash,
  encode(
    extensions.digest(
      convert_to(
        CASE 
          WHEN LENGTH(
            regexp_replace(
              regexp_replace(
                regexp_replace(f->>'content', $re$("{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})$re$, '', 'g'),
                $re$#.*$re$, '', 'g'
              ),
              $re$\s+$re$, '', 'g'
            )
          ) < 10 THEN regexp_replace(f->>'content', $re$\s+$re$, '', 'g')
          ELSE regexp_replace(
            regexp_replace(
              regexp_replace(f->>'content', $re$("{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3})$re$, '', 'g'),
              $re$#.*$re$, '', 'g'
            ),
            $re$\s+$re$, '', 'g'
          )
        END, 
        'UTF8'
      ), 
      'sha256'
    ), 
    'hex'
  ) as nowhitespace_hash
FROM public.assignments, jsonb_array_elements(starter_files) AS f;

CREATE OR REPLACE VIEW public.duplicate_snapshots 
WITH (security_invoker = true)
AS
SELECT
  s.nowhitespace_hash as semantic_hash,
  s.class_id,
  s.file_path,
  COUNT(DISTINCT s.user_id)           AS student_count,
  ARRAY_AGG(DISTINCT s.user_id::text) AS student_ids,
  MAX(s.saved_at)                     AS last_seen
FROM public.file_snapshots s
LEFT JOIN public.starter_file_hashes sfh ON s.nowhitespace_hash = sfh.nowhitespace_hash
WHERE sfh.nowhitespace_hash IS NULL
  AND LENGTH(regexp_replace(s.nowhitespace_hash, $re$\s+$re$, '', 'g')) > 10
GROUP BY s.nowhitespace_hash, s.class_id, s.file_path
HAVING COUNT(DISTINCT s.user_id) > 1;

-- 4. Re-apply permissions
GRANT SELECT ON public.starter_file_hashes TO authenticated;
GRANT SELECT ON public.duplicate_snapshots TO authenticated;
REVOKE ALL ON public.starter_file_hashes FROM anon;
REVOKE ALL ON public.duplicate_snapshots FROM anon;
