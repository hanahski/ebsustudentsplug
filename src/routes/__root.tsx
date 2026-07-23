import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth";
import { AuthStatusBanner } from "@/components/AuthStatusBanner";
import { Toaster } from "@/components/ui/sonner";
import { NetworkStatus } from "@/components/NetworkStatus";
import { AppBridgeMount } from "@/components/AppBridgeMount";
import { VideoSWRegister } from "@/components/VideoSWRegister";
import { KeyboardAware } from "@/components/KeyboardAware";
import { GoogleTranslateBridge } from "@/components/GoogleTranslateBridge";
import { VerifyEmailDialog } from "@/components/VerifyEmailDialog";
import { ConfirmProvider } from "@/components/ConfirmProvider";


import appCss from "../styles.css?url";
const brandLogoUrl = "/brand-logo.png";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">That link doesn't exist on StudentsPlug.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Go home</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const raw = error?.message ?? "";
  const isAuth = /unauthorized|no authorization header|invalid token|no user id found|jwt|not authenticated/i.test(raw);
  const isNetwork = /failed to fetch|network|timeout|offline/i.test(raw);
  const isNotFound = /not found|does not exist|no rows/i.test(raw);
  const isPermission = /admin only|permission denied|forbidden|not allowed/i.test(raw);

  const title = isAuth
    ? "You're signed out"
    : isNetwork
      ? "Connection problem"
      : isPermission
        ? "You don't have access"
        : isNotFound
          ? "Not found"
          : "Something broke";

  const message = isAuth
    ? "Sign in to continue — your session expired or you're not logged in yet."
    : isNetwork
      ? "We couldn't reach StudentsPlug. Check your internet and try again."
      : isPermission
        ? "This action is for admins only."
        : isNotFound
          ? "We couldn't find what you were looking for."
          : raw || "An unexpected error happened.";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <div className="mt-6 flex items-center justify-center gap-2">
          {isAuth ? (
            <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in</Link>
          ) : (
            <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Try again</button>
          )}
          <Link to="/" className="rounded-md border px-4 py-2 text-sm hover:bg-muted">Home</Link>
        </div>
      </div>
    </div>
  );
}

function RouteLoadingIndicator() {
  const isLoading = useRouterState({ select: (state) => state.isLoading });
  if (!isLoading) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 pointer-events-none">
      <div className="h-1 w-full overflow-hidden bg-primary/10">
        <div className="route-loader-bar h-full w-1/2 rounded-r-full bg-hero shadow-glow" />
      </div>
      <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full border bg-background/90 px-3 py-1.5 text-xs font-bold text-primary shadow-card backdrop-blur-md">
        <span className="route-loader-dot" /> Loading StudentsPlug…
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" },
      { title: "StudentsPlug: EBSU Student Community, Past Questions, Hostel & Apartment Listings, Earn as a Student" },
      { name: "description", content: "StudentsPlug is the only website that pays EBSU students for their effort. Find past questions, register for courses, verify your student status, earn as a student, get the latest news and announcements like exam timetables, and access free and cheap textbooks, student deals, and hostel or apartment listings for Ebonyi State University students." },
      { name: "keywords", content: "ebsu student community, ebsu student login, ebsu past questions, ebsu student dashboard, ebsu student portal results checker, cheap textbooks EBSU, student accommodation Abakaliki, student hostel Abakaliki, earn as a student Nigeria, earn money as a student Nigeria, ebsu latest news, ebsu exam timetable, ebsu announcements" },
      { property: "og:title", content: "StudentsPlug: EBSU Student Community, Past Questions, Hostel & Apartment Listings, Earn as a Student" },
      { name: "twitter:title", content: "StudentsPlug: EBSU Student Community, Past Questions, Hostel & Apartment Listings, Earn as a Student" },
      { property: "og:description", content: "StudentsPlug is the only website that pays EBSU students for their effort. Find past questions, register for courses, verify your student status, earn as a student, get the latest news and announcements like exam timetables, and access free and cheap textbooks, student deals, and hostel or apartment listings for Ebonyi State University students." },
      { name: "twitter:description", content: "StudentsPlug is the only website that pays EBSU students for their effort. Find past questions, register for courses, verify your student status, earn as a student, get the latest news and announcements like exam timetables, and access free and cheap textbooks, student deals, and hostel or apartment listings for Ebonyi State University students." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9173903f-b206-4e77-b154-2dc17a1baf06" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/9173903f-b206-4e77-b154-2dc17a1baf06" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "StudentsPlug" },
      { name: "application-name", content: "StudentsPlug" },
      { name: "apple-mobile-web-app-title", content: "StudentsPlug" },
      { name: "google-site-verification", content: "i-0kx77maRBfwhVjm9vXMTclPH33sCj_Ea9I6p-0MHM" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" },
      { rel: "shortcut icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preload", as: "image", href: brandLogoUrl, fetchPriority: "high" },
      { rel: "preconnect", href: "https://toklqndkqjglcxhaeagb.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://toklqndkqjglcxhaeagb.supabase.co" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Work+Sans:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" },
    ],
    scripts: [
      {
        children: `(function(){try{var t=localStorage.getItem('sp-theme');if(!t){t='light';localStorage.setItem('sp-theme',t);}if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){}})();`,
      },
      {
        children: `(function(){try{var CANON='https://ebsustudentsplug.fun';function sync(){try{var h=(location.hostname||'').toLowerCase();var url=CANON+location.pathname+location.search;var head=document.head;if(!head)return;var link=head.querySelector('link[rel="canonical"]');if(!link){link=document.createElement('link');link.setAttribute('rel','canonical');head.appendChild(link);}link.setAttribute('href',url);var og=head.querySelector('meta[property="og:url"]');if(!og){og=document.createElement('meta');og.setAttribute('property','og:url');head.appendChild(og);}og.setAttribute('content',url);var isLovable=h.endsWith('.lovable.app');var rb=head.querySelector('meta[name="robots"][data-sp-guard="1"]');if(isLovable){if(!rb){rb=document.createElement('meta');rb.setAttribute('name','robots');rb.setAttribute('data-sp-guard','1');head.appendChild(rb);}rb.setAttribute('content','noindex, nofollow');}else if(rb){rb.parentNode.removeChild(rb);}}catch(e){}}sync();var _ps=history.pushState;history.pushState=function(){var r=_ps.apply(this,arguments);sync();return r;};var _rs=history.replaceState;history.replaceState=function(){var r=_rs.apply(this,arguments);sync();return r;};window.addEventListener('popstate',sync);}catch(e){}})();`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://ebsustudentsplug.fun/#org",
              name: "StudentsPlug",
              alternateName: "EBSU StudentsPlug",
              url: "https://ebsustudentsplug.fun/",
              logo: "https://ebsustudentsplug.fun/brand-logo.png",
              description: "Student knowledge hub for Ebonyi State University (EBSU) — past questions, study notes, free textbooks, hostel and apartment listings, campus news, marketplace, and Plug AI.",
              areaServed: { "@type": "Country", name: "Nigeria" },
              knowsAbout: ["Ebonyi State University", "EBSU past questions", "EBSU admissions", "Nigerian student life", "student accommodation Abakaliki"],
              sameAs: ["https://ebsustudentsplug.fun/"],
            },
            {
              "@type": "WebSite",
              "@id": "https://ebsustudentsplug.fun/#website",
              name: "StudentsPlug",
              url: "https://ebsustudentsplug.fun/",
              inLanguage: "en-NG",
              publisher: { "@id": "https://ebsustudentsplug.fun/#org" },
              potentialAction: {
                "@type": "SearchAction",
                target: { "@type": "EntryPoint", urlTemplate: "https://ebsustudentsplug.fun/search?q={search_term_string}" },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: ({ children }: { children: React.ReactNode }) => (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  ),
  component: () => {
    const { queryClient } = Route.useRouteContext();
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
            <AppBridgeMount />
            <VideoSWRegister />
            <KeyboardAware />
            <GoogleTranslateBridge />
            <AuthStatusBanner />
            <RouteLoadingIndicator />
            
            <NetworkStatus />
            <Outlet />
            <VerifyEmailDialog />
            <Toaster richColors position="top-center" />
          </ConfirmProvider>
        </AuthProvider>

      </QueryClientProvider>
    );
  },
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});
