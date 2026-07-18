import { confirm } from "@/components/ConfirmProvider";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Phone, MapPin, Trash2, CheckCircle2, ChevronLeft, ChevronRight, ImageOff, PlayCircle, X, ShieldCheck } from "lucide-react";
import { getIsAdminUser } from "@/lib/admin-role";
import { extractHostelSpecs, stripHostelMarker } from "@/lib/hostel-specs";
import { HostelDetailPanel } from "@/components/hostel/HostelCard";
import { extractProductSpecs, stripProductMarker } from "@/lib/product-specs";
import { ProductDetailPanel } from "@/components/product/ProductCard";
import { StorageMedia } from "@/components/StorageMedia";
import { isVideoUrl } from "@/lib/storage-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market/$id")({
  component: ListingDetail,
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("market_listings")
      .select("id,title,description,price,category,photos,is_sold,created_at,location")
      .eq("id", params.id)
      .maybeSingle();
    return { listing: data };
  },
  head: ({ params, loaderData }) => {
    const url = `https://ebsustudentsplug.fun/market/${params.id}`;
    const l = loaderData?.listing as any;
    if (!l) {
      return {
        meta: [
          { title: "Market listing — StudentsPlug" },
          { name: "description", content: "Browse and buy from verified EBSU student sellers on the StudentsPlug market." },
          { property: "og:url", content: url },
        ],
        links: [{ rel: "canonical", href: url }],
      };
    }

    const isHostel = String(l.category ?? "").toLowerCase() === "hostel";
    const rawDesc = String(l.description ?? "").replace(/<!--[\s\S]*?-->/g, "").trim();
    const photos: string[] = Array.isArray(l.photos) ? l.photos.filter((p: any) => typeof p === "string") : [];
    const image = photos[0];
    const priceStr = `₦${Number(l.price).toLocaleString()}`;

    // Pull hostel specs so search results tell renters what's inside.
    let hostelSpecs: any = null;
    if (isHostel) {
      const m = String(l.description ?? "").match(/<!--HOSTEL::([A-Za-z0-9+/=]+)-->/);
      if (m) { try { hostelSpecs = JSON.parse(atob(m[1])); } catch {} }
    }

    const title = isHostel
      ? `${l.title} — ${priceStr} | Hostel / Apartment near EBSU`
      : `${l.title} — ${priceStr} | StudentsPlug Market`;

    const hostelSummary = hostelSpecs
      ? [
          hostelSpecs.bedrooms ? `${hostelSpecs.bedrooms} bed` : null,
          hostelSpecs.toilets ? `${hostelSpecs.toilets} bath` : null,
          hostelSpecs.ac ? "AC" : null,
          hostelSpecs.kitchen ? "kitchen" : null,
          hostelSpecs.water_heater ? "water heater" : null,
          ...(Array.isArray(hostelSpecs.features) ? hostelSpecs.features.slice(0, 4).map((f: string) => f.replace(/_/g, " ")) : []),
        ].filter(Boolean).join(" · ")
      : "";

    const desc = isHostel
      ? (`${l.title} for rent near Ebonyi State University (EBSU), Abakaliki — ${priceStr}. ` +
         (hostelSummary ? `${hostelSummary}. ` : "") +
         (hostelSpecs?.address ? `Located at ${hostelSpecs.address}. ` : "") +
         (rawDesc.slice(0, 120) || "Contact the verified student landlord on StudentsPlug.")
        ).slice(0, 300)
      : (rawDesc.slice(0, 160) || `Buy ${l.title} from a verified EBSU student on StudentsPlug Market.`);

    const productLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: l.title,
      description: desc,
      image: photos.length ? photos : undefined,
      category: l.category,
      offers: {
        "@type": "Offer",
        price: l.price,
        priceCurrency: "NGN",
        availability: l.is_sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        url,
      },
    };

    // Hostels get an additional RealEstateListing + Accommodation schema so
    // Google Housing / rich results surface bedrooms, amenities and address.
    const amenityFeatures = hostelSpecs
      ? [
          hostelSpecs.ac ? "Air conditioning" : null,
          hostelSpecs.kitchen ? "Kitchen" : null,
          hostelSpecs.water_heater ? "Water heater" : null,
          ...(Array.isArray(hostelSpecs.features)
            ? hostelSpecs.features.map((f: string) => f.replace(/_/g, " "))
            : []),
        ]
          .filter(Boolean)
          .map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true }))
      : [];

    const realEstateLd = isHostel
      ? {
          "@context": "https://schema.org",
          "@type": "RealEstateListing",
          name: l.title,
          description: desc,
          url,
          datePosted: l.created_at,
          image: photos.length ? photos : undefined,
          offers: {
            "@type": "Offer",
            price: l.price,
            priceCurrency: "NGN",
            availability: l.is_sold ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            url,
          },
          about: {
            "@type": "Accommodation",
            name: l.title,
            numberOfBedrooms: hostelSpecs?.bedrooms ?? undefined,
            numberOfBathroomsTotal: hostelSpecs?.toilets ?? undefined,
            amenityFeature: amenityFeatures.length ? amenityFeatures : undefined,
            address: hostelSpecs?.address
              ? {
                  "@type": "PostalAddress",
                  streetAddress: hostelSpecs.address,
                  addressLocality: "Abakaliki",
                  addressRegion: "Ebonyi",
                  addressCountry: "NG",
                }
              : {
                  "@type": "PostalAddress",
                  addressLocality: "Abakaliki",
                  addressRegion: "Ebonyi",
                  addressCountry: "NG",
                },
          },
        }
      : null;

    const scripts = [
      { type: "application/ld+json", children: JSON.stringify(productLd) },
      ...(realEstateLd ? [{ type: "application/ld+json", children: JSON.stringify(realEstateLd) }] : []),
    ];

    return {
      meta: [
        { title },
        { name: "description", content: desc },
        ...(isHostel
          ? [{ name: "keywords", content: `EBSU hostel, Abakaliki apartment, student accommodation Ebonyi, ${l.title}` }]
          : []),
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: isHostel ? "website" : "product" },
        { property: "og:url", content: url },
        ...(image ? [{ property: "og:image", content: image }, { name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts,
    };
  },
});


function ListingDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: listing, refetch } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => (await supabase.from("market_listings").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: seller } = useQuery({
    queryKey: ["seller", listing?.seller_id],
    enabled: !!listing?.seller_id,
    queryFn: async () => {
      const { data: prof } = await supabase.from("profiles").select("id,display_name,avatar_key,is_verified,is_legit").eq("id", listing!.seller_id).single();
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", listing!.seller_id);
      const isAdminSeller = !!roles?.some((r) => r.role === "admin");
      return prof ? { ...prof, isAdminSeller } : null;
    },
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user,
    queryFn: async () => getIsAdminUser(user!.id),
  });

  if (!listing) return <AppShell><p>Loading…</p></AppShell>;
  const canManage = user && (user.id === listing.seller_id || isAdmin);

  const markSold = async () => {
    await supabase.from("market_listings").update({ is_sold: !listing.is_sold }).eq("id", id);
    toast.success(listing.is_sold ? "Marked as available" : "Marked as sold");
    refetch();
  };
  const del = async () => {
    if (!(await confirm({ title: "Delete this listing?", description: "It will be removed from the market immediately.", variant: "destructive", confirmText: "Delete listing", icon: "trash" }))) return;
    const { error } = await supabase.from("market_listings").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deleted"); nav({ to: "/market" }); }
  };

  const photos: string[] = Array.isArray(listing.photos)
    ? (listing.photos.filter((p): p is string => typeof p === "string" && !!p))
    : [];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/market" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-4 h-4" />Back to market</Link>

        <MediaGallery photos={photos} title={listing.title} sold={!!listing.is_sold} />

        <div className="bg-card border rounded-3xl p-6 shadow-card">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold font-display">{listing.title}</h1>
                {listing.is_sold && <span className="px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive font-semibold">SOLD</span>}
              </div>
              <p className="text-3xl font-bold text-primary mt-2">₦{Number(listing.price).toLocaleString()}</p>
              <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                <span className="px-2 py-0.5 rounded-full bg-muted">{listing.category}</span>
                {listing.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{listing.location}</span>}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={markSold}><CheckCircle2 className="w-4 h-4 mr-1" />{listing.is_sold ? "Mark available" : "Mark sold"}</Button>
                <Button variant="destructive" size="sm" onClick={del}><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </div>
          {(() => {
            const hostel = extractHostelSpecs(listing.description);
            const product = hostel ? null : extractProductSpecs(listing.description);
            const clean = hostel
              ? stripHostelMarker(listing.description)
              : product
                ? stripProductMarker(listing.description)
                : listing.description;
            return (
              <>
                {clean && <p className="mt-4 whitespace-pre-wrap leading-relaxed">{clean}</p>}
                {hostel && <HostelDetailPanel specs={hostel} />}
                {product && <ProductDetailPanel specs={product} />}
              </>
            );
          })()}
          <div className="mt-6 p-4 rounded-2xl bg-muted/40 border">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Contact seller</p>
            <p className="flex items-center gap-2 font-medium"><Phone className="w-4 h-4 text-primary" />{listing.contact}</p>
            {seller && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5 flex-wrap">
                <span>Posted by</span>
                <Link to="/profile/$id" params={{ id: seller.id }} className="text-primary hover:underline font-medium">{seller.display_name}</Link>
                <VerifiedBadge isAdmin={seller.isAdminSeller} isVerified={seller.is_verified} isLegit={seller.is_legit} />
              </p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function VerifiedBadge({ isAdmin, isVerified, isLegit }: { isAdmin?: boolean; isVerified?: boolean; isLegit?: boolean }) {
  if (!isAdmin && !isVerified && !isLegit) return null;
  const label = isAdmin ? "Admin" : isVerified ? "Verified" : "Legit";
  const cls = isAdmin
    ? "bg-primary/15 text-primary border-primary/30 shadow-[0_0_10px_hsl(var(--primary)/0.35)]"
    : isVerified
    ? "bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-[0_0_10px_rgb(56_189_248/0.35)]"
    : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgb(52_211_153/0.35)]";
  return (
    <span title={`${label} seller`} className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full border", cls)}>
      <ShieldCheck className="w-3 h-3" />{label}
    </span>
  );
}

function MediaGallery({ photos, title, sold }: { photos: string[]; title: string; sold: boolean }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);

  if (!photos.length) {
    return (
      <div className="relative aspect-[4/3] rounded-3xl border-2 border-dashed border-border bg-gradient-to-br from-muted/40 to-muted/10 flex flex-col items-center justify-center text-muted-foreground overflow-hidden">
        <ImageOff className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-sm font-medium">No photos yet</p>
      </div>
    );
  }

  const current = photos[active] ?? photos[0];
  const currentIsVideo = isVideoUrl(current);
  const go = (delta: number) => setActive((i) => (i + delta + photos.length) % photos.length);

  return (
    <>
      <div className="rounded-3xl overflow-hidden border-2 border-primary/20 bg-black shadow-card">
        <div className="relative aspect-[4/3] sm:aspect-[16/10] group">
          <button
            type="button"
            onClick={() => !currentIsVideo && setZoom(true)}
            className="absolute inset-0 w-full h-full"
            aria-label={currentIsVideo ? "Video" : "Zoom photo"}
          >
            <StorageMedia
              url={current}
              alt={title}
              className="w-full h-full object-contain bg-black"
            />
            {currentIsVideo && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <PlayCircle className="w-16 h-16 text-white/80 drop-shadow-lg" />
              </span>
            )}
          </button>

          {sold && (
            <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-destructive text-destructive-foreground text-xs font-bold uppercase tracking-wider shadow-lg">
              Sold
            </span>
          )}
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur text-white text-[11px] font-semibold">
            {active + 1} / {photos.length}
          </span>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur transition"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur transition"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {photos.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto bg-card/80 backdrop-blur">
            {photos.map((p, i) => {
              const isVid = isVideoUrl(p);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActive(i)}
                  className={cn(
                    "relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition",
                    i === active ? "border-primary ring-2 ring-primary/40" : "border-border/60 opacity-70 hover:opacity-100",
                  )}
                  aria-label={`Photo ${i + 1}`}
                >
                  <StorageMedia url={p} alt="" as="img" className="w-full h-full object-cover" />
                  {isVid && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <PlayCircle className="w-5 h-5 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {zoom && !currentIsVideo && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
            onClick={() => setZoom(false)}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <StorageMedia url={current} alt={title} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}