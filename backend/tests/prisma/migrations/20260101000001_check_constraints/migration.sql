-- CHECK constraints from the architecture plan (Section 8.1) that Prisma's DSL cannot express.
ALTER TABLE "books" ADD CONSTRAINT "books_price_check" CHECK ("price" >= 0);
ALTER TABLE "books" ADD CONSTRAINT "books_stock_check" CHECK ("stock_quantity" >= 0);
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_discount_value_check" CHECK ("discount_value" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_subtotal_check" CHECK ("subtotal_amount" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_check" CHECK ("total_amount" >= 0);
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_check" CHECK ("refund_amount" > 0);
