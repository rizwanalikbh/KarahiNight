// Preset event banner variants. Each has a static image bundled with the app.
// Admins can pick one of these, or upload a custom banner instead (see
// Event.bannerVariant === "custom" + Event.customBannerUrl).
export const BANNER_VARIANTS = [
  { id: "banner-1", label: "Classic Karahi", src: "/banners/banner-1.png" },
  { id: "banner-2", label: "Chicken Karahi", src: "/banners/banner-2-chicken-karahi.jpg" },
  { id: "banner-3", label: "Spice Market", src: "/banners/banner-3.jpg" },
  { id: "banner-4", label: "Fresh Naan", src: "/banners/banner-4.jpg" },
  { id: "banner-5", label: "Festive Table", src: "/banners/banner-5.jpg" },
  { id: "banner-6", label: "Golden Pattern", src: "/banners/banner-6.jpg" },
  { id: "banner-7", label: "Gujranwala Grill", src: "/banners/banner-7.jpg" },
  { id: "banner-8", label: "Lahore Food Street", src: "/banners/banner-8-lahore.jpg" },
  { id: "banner-9", label: "Peshawar Tikka", src: "/banners/banner-9-peshawar.jpg" },
] as const;

export const DEFAULT_BANNER_ID = BANNER_VARIANTS[0].id;

/** Resolves the image src to show for an event/summary given its banner fields. */
export function getBannerSrc(banner: { bannerVariant?: string | null; customBannerUrl?: string | null }): string {
  if (banner.bannerVariant === "custom" && banner.customBannerUrl) {
    return `/api/storage${banner.customBannerUrl}`;
  }
  const variant = BANNER_VARIANTS.find((v) => v.id === banner.bannerVariant);
  return variant?.src ?? BANNER_VARIANTS[0].src;
}
