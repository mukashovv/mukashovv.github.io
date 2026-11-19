begin;

-- The storefront supplies standard preview sizes. Keep any previously saved dimensions.
alter table public.prints_artworks
    drop constraint prints_original_offer_complete,
    drop constraint prints_print_offer_complete,
    add constraint prints_original_offer_complete check (original_price is not null or not original_sold),
    add constraint prints_print_offer_complete check (print_price is not null or print_stock is null);

commit;
