-- Bunny Stream as a third video source, next to private storage (MP4) and Mux.
-- lessons.video_ref then holds the Bunny video ID (a UUID) of the SANADY library.
alter type public.video_provider add value if not exists 'bunny';
