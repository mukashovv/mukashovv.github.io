begin;

alter table public.prints_artworks
    add column original_price integer check (original_price between 1 and 100000000),
    add column original_width numeric(5,1) check (original_width between 0.1 and 1000),
    add column original_height numeric(5,1) check (original_height between 0.1 and 1000),
    add column original_sold boolean not null default false,
    add column print_price integer check (print_price between 1 and 100000000),
    add column print_width numeric(5,1) check (print_width between 0.1 and 1000),
    add column print_height numeric(5,1) check (print_height between 0.1 and 1000),
    add column print_stock integer check (print_stock between 0 and 100000),
    add constraint prints_original_offer_complete check (
        (original_price is null and original_width is null and original_height is null and not original_sold)
        or (original_price is not null and original_width is not null and original_height is not null)
    ),
    add constraint prints_print_offer_complete check (
        (print_price is null and print_width is null and print_height is null and print_stock is null)
        or (print_price is not null and print_width is not null and print_height is not null)
    );

grant select (original_price, original_width, original_height, original_sold, print_price, print_width, print_height, print_stock)
    on public.prints_artworks to anon, authenticated;
grant insert (original_price, original_width, original_height, original_sold, print_price, print_width, print_height, print_stock),
      update (original_price, original_width, original_height, original_sold, print_price, print_width, print_height, print_stock)
    on public.prints_artworks to authenticated;

commit;
