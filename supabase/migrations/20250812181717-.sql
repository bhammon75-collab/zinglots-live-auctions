do $$ begin
  alter publication supabase_realtime add table app.lots;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table app.bids;
exception when duplicate_object then null;
end $$;