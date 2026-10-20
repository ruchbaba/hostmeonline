DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_posts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;
  END IF;
END $$;