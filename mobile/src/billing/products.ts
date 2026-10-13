/**
 * Store product ids. Change these to the ids created in App Store Connect
 * and Play Console. There is no price in this file. The store returns the price.
 */
export type StoreProductConfig = {
  productId: string;
  title: string;
  cadence: "month" | "year";
};

export const STORE_PRODUCTS: readonly StoreProductConfig[] = [
  {
    productId: "vkole_engine_monthly",
    title: "VKOLE engine for one student, monthly",
    cadence: "month",
  },
  {
    productId: "vkole_engine_yearly",
    title: "VKOLE engine for one student, yearly",
    cadence: "year",
  },
];

export function productIds(): string[] {
  return STORE_PRODUCTS.map((product) => product.productId);
}
