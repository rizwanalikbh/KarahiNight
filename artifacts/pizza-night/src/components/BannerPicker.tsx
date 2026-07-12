import { Check, Loader2, Upload, X } from "lucide-react";
import { useUpload } from "@workspace/object-storage-web";
import { BANNER_VARIANTS, getBannerSrc } from "../lib/banners";
import { useToast } from "@/hooks/use-toast";

export type BannerValue = { bannerVariant: string | null; customBannerUrl: string | null };

export function BannerPicker({
  value,
  onChange,
}: {
  value: BannerValue;
  onChange: (next: BannerValue) => void;
}) {
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => onChange({ bannerVariant: "custom", customBannerUrl: response.objectPath }),
    onError: () => toast({ title: "Failed to upload banner", variant: "destructive" }),
  });

  const isCustom = value.bannerVariant === "custom" && !!value.customBannerUrl;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Banner</label>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {BANNER_VARIANTS.map((variant) => {
          const selected = !isCustom && (value.bannerVariant ?? BANNER_VARIANTS[0].id) === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onChange({ bannerVariant: variant.id, customBannerUrl: null })}
              className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all ${
                selected ? "border-primary ring-2 ring-primary/30" : "border-border/60 hover:border-primary/40"
              }`}
              title={variant.label}
            >
              <img src={variant.src} alt={variant.label} className="w-full h-full object-cover" />
              {selected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="bg-primary rounded-full p-0.5">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                </div>
              )}
              <span className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] leading-tight px-1 py-0.5 truncate">
                {variant.label}
              </span>
            </button>
          );
        })}

        <label
          className={`relative rounded-lg overflow-hidden aspect-video border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
            isCustom ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-dashed border-border/60 hover:border-primary/40 bg-secondary/20"
          }`}
        >
          {isCustom ? (
            <img src={getBannerSrc(value)} alt="Custom banner" className="absolute inset-0 w-full h-full object-cover" />
          ) : null}
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground z-10" />
          ) : (
            <Upload className={`w-4 h-4 z-10 ${isCustom ? "text-white drop-shadow" : "text-muted-foreground"}`} />
          )}
          <span className={`text-[10px] font-medium z-10 ${isCustom ? "text-white drop-shadow" : "text-muted-foreground"}`}>
            {isCustom ? "Change" : "Upload"}
          </span>
          {isCustom && (
            <div className="absolute bottom-0 inset-x-0 bg-black/55 text-white text-[10px] leading-tight px-1 py-0.5 truncate z-10">
              Custom
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
              e.target.value = "";
            }}
          />
        </label>

        {isCustom && (
          <button
            type="button"
            onClick={() => onChange({ bannerVariant: BANNER_VARIANTS[0].id, customBannerUrl: null })}
            className="col-span-3 sm:col-span-6 text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1 justify-start mt-0.5"
          >
            <X className="w-3 h-3" /> Remove custom banner, use a preset instead
          </button>
        )}
      </div>
    </div>
  );
}
