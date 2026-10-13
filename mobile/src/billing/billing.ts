import { productIds, STORE_PRODUCTS, type StoreProductConfig } from "./products.ts";

export type StoreOffer = {
  productId: string;
  title: string;
  /** Text the store itself returned, such as a localized price. Never invented here. */
  priceLabel: string;
};

export type PurchaseResult = {
  status: "purchased" | "cancelled" | "unavailable";
  productId: string;
};

export type StoreBilling = {
  readonly configured: boolean;
  loadOffers(): Promise<StoreOffer[]>;
  purchase(productId: string): Promise<PurchaseResult>;
  restore(): Promise<{ productIds: string[] }>;
};

export type StorePackage = {
  productId: string;
  title?: string;
  priceLabel?: string;
};

/** Keep only packages the store priced, and only ids this app is allowed to sell. */
export function offersFromStorePackages(packages: readonly StorePackage[]): StoreOffer[] {
  const allowed = new Set(productIds());
  const offers: StoreOffer[] = [];
  for (const pack of packages) {
    const priceLabel = pack.priceLabel?.trim() ?? "";
    if (!allowed.has(pack.productId) || !priceLabel) continue;
    const known = STORE_PRODUCTS.find((product) => product.productId === pack.productId);
    offers.push({
      productId: pack.productId,
      title: known?.title || pack.title?.trim() || pack.productId,
      priceLabel,
    });
  }
  return offers;
}

export function unconfiguredBilling(): StoreBilling {
  return {
    configured: false,
    async loadOffers() {
      return [];
    },
    async purchase(productId: string) {
      return { status: "unavailable", productId };
    },
    async restore() {
      return { productIds: [] };
    },
  };
}

type RevenueCatPackage = {
  product: { identifier: string; title?: string; priceString?: string };
};

type RevenueCatModule = {
  Purchases: {
    configure: (options: { apiKey: string }) => Promise<void>;
    getOfferings: () => Promise<{
      current?: { availablePackages?: RevenueCatPackage[] } | null;
    }>;
    purchasePackage: (options: { aPackage: RevenueCatPackage }) => Promise<unknown>;
    restorePurchases: () => Promise<{
      customerInfo?: { entitlements?: { active?: Record<string, { productIdentifier?: string }> } };
    }>;
  };
};

let configuredKey = "";

async function revenueCat(): Promise<RevenueCatModule> {
  return (await import("@revenuecat/purchases-capacitor")) as unknown as RevenueCatModule;
}

async function packagesFor(apiKey: string): Promise<RevenueCatPackage[]> {
  const { Purchases } = await revenueCat();
  if (configuredKey !== apiKey) {
    await Purchases.configure({ apiKey });
    configuredKey = apiKey;
  }
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}

/**
 * StoreKit on iPhone and Google Play Billing on Android, through RevenueCat.
 * An empty key returns the unconfigured billing object and does not contact the store.
 */
export function createStoreBilling(apiKey: string): StoreBilling {
  const key = apiKey.trim();
  if (!key) return unconfiguredBilling();
  return {
    configured: true,
    async loadOffers() {
      try {
        const packages = await packagesFor(key);
        return offersFromStorePackages(
          packages.map((pack) => ({
            productId: pack.product.identifier,
            title: pack.product.title,
            priceLabel: pack.product.priceString,
          })),
        );
      } catch {
        return [];
      }
    },
    async purchase(productId) {
      if (!productIds().includes(productId)) return { status: "unavailable", productId };
      try {
        const { Purchases } = await revenueCat();
        const packages = await packagesFor(key);
        const found = packages.find((pack) => pack.product.identifier === productId);
        if (!found?.product.priceString?.trim()) return { status: "unavailable", productId };
        await Purchases.purchasePackage({ aPackage: found });
        return { status: "purchased", productId };
      } catch (error) {
        const code = (error as { code?: string; userCancelled?: boolean } | null)?.code ?? "";
        const cancelled =
          (error as { userCancelled?: boolean } | null)?.userCancelled === true ||
          code.toLowerCase().includes("cancel");
        return { status: cancelled ? "cancelled" : "unavailable", productId };
      }
    },
    async restore() {
      try {
        const { Purchases } = await revenueCat();
        if (configuredKey !== key) {
          await Purchases.configure({ apiKey: key });
          configuredKey = key;
        }
        const restored = await Purchases.restorePurchases();
        const active = restored.customerInfo?.entitlements?.active ?? {};
        const ids = Object.values(active)
          .map((item) => item.productIdentifier ?? "")
          .filter((id) => productIds().includes(id));
        return { productIds: ids };
      } catch {
        return { productIds: [] };
      }
    },
  };
}

export function revenueCatKeyFor(platform: string, androidKey: string, iosKey: string): string {
  if (platform === "android") return androidKey.trim();
  if (platform === "ios") return iosKey.trim();
  return "";
}

export function productById(productId: string): StoreProductConfig | undefined {
  return STORE_PRODUCTS.find((product) => product.productId === productId);
}
