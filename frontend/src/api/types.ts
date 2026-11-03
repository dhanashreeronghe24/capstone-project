import type { components, operations } from './schema';

/** Shorthand for every schema in the OpenAPI contract. */
export type Schemas = components['schemas'];

export type Problem = Schemas['Problem'];
export type Pagination = Schemas['Pagination'];

export type RegisterRequest = Schemas['RegisterRequest'];
export type LoginRequest = Schemas['LoginRequest'];
export type TokenPair = Schemas['TokenPair'];
export type UserSummary = Schemas['UserSummary'];
export type AuthResponse = Schemas['AuthResponse'];
export type Profile = Schemas['Profile'];
export type UpdateProfileRequest = Schemas['UpdateProfileRequest'];
export type Address = Schemas['Address'];
export type AddressInput = Schemas['AddressInput'];

export type BookFormat = Schemas['BookFormat'];
export type Category = Schemas['Category'];
export type CategoryNode = Schemas['CategoryNode'];
export type BookSummary = Schemas['BookSummary'];
export type BookDetail = Schemas['BookDetail'];
export type BookPage = Schemas['BookPage'];
export type FeaturedSections = Schemas['FeaturedSections'];
export type AuthorDetail = Schemas['AuthorDetail'];
export type Review = Schemas['Review'];
export type ReviewInput = Schemas['ReviewInput'];
export type ReviewPage = Schemas['ReviewPage'];

export type Cart = Schemas['Cart'];
export type CartItem = Schemas['CartItem'];
export type AddCartItemRequest = Schemas['AddCartItemRequest'];
export type UpdateCartItemRequest = Schemas['UpdateCartItemRequest'];
export type WishlistItem = Schemas['WishlistItem'];

export type ShippingTier = Schemas['ShippingTier'];
export type OrderStatus = Schemas['OrderStatus'];
export type CheckoutSummaryRequest = Schemas['CheckoutSummaryRequest'];
export type CheckoutSummary = Schemas['CheckoutSummary'];
export type OrderItem = Schemas['OrderItem'];
export type Order = Schemas['Order'];
export type OrderPage = Schemas['OrderPage'];
export type CouponValidation = Schemas['CouponValidation'];

export type PaymentMethod = Schemas['PaymentMethod'];
export type PaymentStatus = Schemas['PaymentStatus'];
export type PaymentTransaction = Schemas['PaymentTransaction'];
export type ConfirmPaymentRequest = Schemas['ConfirmPaymentRequest'];
export type PaymentOutcome = Schemas['PaymentOutcome'];

export type ShippingRate = Schemas['ShippingRate'];
export type DeliveryEstimate = Schemas['DeliveryEstimate'];
export type Tracking = Schemas['Tracking'];

/**
 * The generated `CreateOrderRequest` collapses to `unknown` because the spec expresses
 * "addressId OR shippingAddress" with `anyOf` on required-only branches. This hand-written
 * type mirrors the documented contract (exactly one of the two address fields is required).
 */
export type CreateOrderRequest = (
  | { addressId: string; shippingAddress?: undefined }
  | { shippingAddress: AddressInput; addressId?: undefined }
) & {
  shippingTier?: ShippingTier;
  couponCode?: string;
  redeemPoints?: number;
};

/** Query parameters of an operation, taken straight from the generated contract. */
type QueryOf<K extends keyof operations> = NonNullable<operations[K]['parameters']['query']>;

export type SearchBooksParams = QueryOf<'searchBooks'>;
export type ListOrdersParams = QueryOf<'listOrders'>;
export type EstimateDeliveryParams = QueryOf<'estimateDelivery'>;
export type PageParams = { page?: number; limit?: number };
