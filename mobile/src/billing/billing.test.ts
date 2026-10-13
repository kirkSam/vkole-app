import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStoreBilling, offersFromStorePackages, revenueCatKeyFor } from "./billing.ts";
import { STORE_PRODUCTS } from "./products.ts";

describe("store billing", () => {
  it("keeps prices out of the product config", () => {
    for (const product of STORE_PRODUCTS) {
      assert.equal(Object.hasOwn(product, "price"), false);
      assert.equal(Object.hasOwn(product, "priceLabel"), false);
      assert.match(product.productId, /^[a-z0-9_.]+$/);
    }
    const source = JSON.stringify(STORE_PRODUCTS);
    assert.equal(source.includes("$"), false);
    assert.equal(/\d+\.\d{2}/.test(source), false);
  });

  it("uses a store price only when the store sent one", () => {
    const offers = offersFromStorePackages([
      { productId: "vkole_engine_monthly", priceLabel: "STORE" },
      { productId: "vkole_engine_yearly", priceLabel: "  " },
      { productId: "someone_elses_sku", priceLabel: "9.00" },
    ]);
    assert.deepEqual(
      offers.map((offer) => offer.productId),
      ["vkole_engine_monthly"],
    );
    assert.equal(offers[0]?.priceLabel, "STORE");
  });

  it("does not charge when no store key is configured", async () => {
    const billing = createStoreBilling("  ");
    assert.equal(billing.configured, false);
    assert.deepEqual(await billing.loadOffers(), []);
    assert.equal((await billing.purchase("vkole_engine_monthly")).status, "unavailable");
    assert.deepEqual(await billing.restore(), { productIds: [] });
  });

  it("does not arm billing in a browser preview", () => {
    assert.equal(revenueCatKeyFor("web", "android-key", "ios-key"), "");
    assert.equal(revenueCatKeyFor("android", " android-key ", ""), "android-key");
    assert.equal(revenueCatKeyFor("ios", "", " ios-key "), "ios-key");
  });
});
