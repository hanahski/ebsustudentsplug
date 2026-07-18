import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, ExternalLink, Calendar, Pencil, Trash2, Loader2, X, Save, ShieldAlert } from "lucide-react";
import { renderArticleHtml } from "@/lib/render-article";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StoryEditor } from "@/components/StoryEditor";
import { ShimmerImage } from "@/components/ShimmerImage";
import { deleteEbsuArticle, updateEbsuArticle } from "@/lib/ebsu-manual-post.functions";
import { InArticleAd } from "@/components/InArticleAd";
import { toast } from "sonner";



export const Route = createFileRoute("/news_/$slug")({
  component: NewsArticlePage,
  head: ({ loaderData, params }: any) => {
    const a = loaderData?.article;
    const url = `https://ebsustudentsplug.fun/news/${params?.slug ?? ""}`;
    if (!a) return { meta: [{ title: "News — StudentsPlug" }], links: [{ rel: "canonical", href: url }] };
    return {
      meta: [
        { title: `${a.title} — EBSU Plug News`.slice(0, 70) },
        { name: "description", content: (a.summary ?? a.title).slice(0, 160) },
        { property: "og:title", content: a.title },
        { property: "og:description", content: (a.summary ?? a.title).slice(0, 200) },
        ...(a.image_url ? [{ property: "og:image", content: a.image_url }] : []),
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "article:published_time", content: a.published_at ?? "" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: a.title,
          description: a.summary ?? undefined,
          image: a.image_url ?? undefined,
          datePublished: a.published_at ?? undefined,
          author: { "@type": "Organization", name: "StudentsPlug" },
        }),
      }],
    };
  },
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("news_articles")
      .select("*")
      .eq("slug", params.slug)
      .eq("status", "published")
      .maybeSingle();
    if (!data) throw notFound();
    return { article: data };
  },
  notFoundComponent: () => (
    <AppShell>
      <div className="text-center py-16">
        <p className="font-bold">Article not found.</p>
        <Link to="/news" className="text-primary text-sm hover:underline">Back to news</Link>
      </div>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell><p className="text-sm text-destructive py-8 text-center">Couldn't load: {error.message}</p></AppShell>
  ),
});

function NewsArticlePage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, profile, user } = useAuth();
  const canManage = isAdmin || !!(profile as any)?.is_legit || !!(profile as any)?.is_verified_source;

  const { data: a, refetch } = useQuery({
    queryKey: ["news-article", slug],
    queryFn: async () => {
      const { data } = await supabase.from("news_articles").select("*").eq("slug", slug).maybeSingle();
      return data;
    },
  });

  const deleteFn = useServerFn(deleteEbsuArticle);
  const updateFn = useServerFn(updateEbsuArticle);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", summary: "", body: "", imageUrl: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!a) return <AppShell><p className="text-sm text-muted-foreground py-8 text-center">Loading…</p></AppShell>;


  const sources: string[] = Array.isArray(a.source_urls) ? (a.source_urls as any[]).filter((x): x is string => typeof x === "string") : [];

  const openEdit = () => {
    setForm({
      title: a.title ?? "",
      summary: a.summary ?? "",
      body: a.body ?? "",
      imageUrl: a.image_url ?? "",
    });
    setEditing(true);
  };

  const onSave = async () => {
    if (!form.title.trim() || form.body.trim().length < 10) {
      toast.error("Title and body are required.");
      return;
    }
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: a.id,
          title: form.title.trim(),
          summary: form.summary.trim() || null,
          body: form.body,
          imageUrl: form.imageUrl.trim() || null,
        },
      });
      toast.success("Article updated");
      setEditing(false);
      await refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {

    setConfirmDelete(false);
    setDeleting(true);
    try {
      await deleteFn({ data: { id: a.id } });
      toast.success("Article deleted");
      navigate({ to: "/news" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to delete");
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <article className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <Link to="/news" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> All news
          </Link>
          {canManage && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={openEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleting}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Delete
              </Button>
            </div>
          )}
        </div>

        <div className="inline-block text-xs font-bold uppercase tracking-wider text-primary mb-2">
          EBSU News
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight mb-3">{a.title}</h1>
        {a.summary && <p className="text-lg text-muted-foreground mb-4">{a.summary}</p>}

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-5">
          <Calendar className="w-3.5 h-3.5" />
          {new Date(a.published_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>

        {a.image_url && (
          <ShimmerImage
            src={a.image_url}
            alt=""
            aspect="16 / 9"
            wrapperClassName="w-full rounded-2xl mb-6 shadow-card bg-muted"
            className="w-full h-full object-cover"
          />
        )}

        <div
          className="prose prose-sm sm:prose-base max-w-none dark:prose-invert prose-headings:font-display prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: renderArticleHtml(a.body) }}
        />

      </article>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-lg">Edit article</h3>
            <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Summary</label>
              <Textarea rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Cover image URL</label>
              <Input value={form.imageUrl} placeholder="https://…" onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Body</label>
              <StoryEditor
                value={form.body}
                onChange={(html) => setForm((f) => ({ ...f, body: html }))}
                userId={user?.id}
                placeholder="Write the article. Drag or paste images anywhere."
                minHeight={280}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
              <Button onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>Delete this article?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-1">
              "{a.title}" will be permanently removed from EBSU News. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
