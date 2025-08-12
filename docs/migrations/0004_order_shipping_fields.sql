alter table app.orders
  add column if not exists shipping_tracking text,
  add column if not exists shipping_carrier  text,
  add column if not exists label_url         text;
