-- Add class_id to file_snapshots for class-level isolation
-- This fixes 'multiple rows' errors when students have same-path files in different classes.

ALTER TABLE public.file_snapshots 
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- Create index for faster lookups per class
CREATE INDEX IF NOT EXISTS idx_snapshots_class ON public.file_snapshots (class_id);

-- Update the duplicate_snapshots view to be more useful (group by class as well if needed)
-- (Leaving it as is for now for global plagiarism detection, but identifying class is better)
