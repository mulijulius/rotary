import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/admin/news")({
  component: AdminNews,
});

type NewsArticle = Database["public"]["Tables"]["news_articles"]["Row"];

function AdminNews() {
  const { role } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[] | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    cover_image_url: "",
    published: false,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data, error } = await supabase
      .from("news_articles")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) {
      console.error("[admin/news] failed to load", error);
      toast.error("Couldn't load news articles.");
      return;
    }
    setArticles(data);
  }

  function handleOpenDialog(article?: NewsArticle) {
    if (article) {
      setEditingArticle(article);
      setFormData({
        title: article.title,
        slug: article.slug,
        excerpt: article.excerpt || "",
        body: article.body,
        cover_image_url: article.cover_image_url || "",
        published: article.published,
      });
    } else {
      setEditingArticle(null);
      setFormData({
        title: "",
        slug: "",
        excerpt: "",
        body: "",
        cover_image_url: "",
        published: false,
      });
    }
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
    setEditingArticle(null);
  }

  async function handleSaveArticle() {
    if (!formData.title || !formData.slug || !formData.body) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setBusyId("save");
    try {
      if (editingArticle) {
        const { error } = await supabase
          .from("news_articles")
          .update({
            title: formData.title,
            slug: formData.slug,
            excerpt: formData.excerpt || null,
            body: formData.body,
            cover_image_url: formData.cover_image_url || null,
            published: formData.published,
            published_at: formData.published ? new Date().toISOString() : null,
          })
          .eq("id", editingArticle.id);
        if (error) throw error;
        toast.success("Article updated.");
      } else {
        const { error } = await supabase.from("news_articles").insert({
          title: formData.title,
          slug: formData.slug,
          excerpt: formData.excerpt || null,
          body: formData.body,
          cover_image_url: formData.cover_image_url || null,
          published: formData.published,
          published_at: formData.published ? new Date().toISOString() : null,
        });
        if (error) throw error;
        toast.success("Article created.");
      }
      handleCloseDialog();
      load();
    } catch (err) {
      console.error("[admin/news] save error", err);
      toast.error(err instanceof Error ? err.message : "Failed to save article.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTogglePublish(article: NewsArticle) {
    setBusyId(article.id.toString());
    try {
      const { error } = await supabase
        .from("news_articles")
        .update({
          published: !article.published,
          published_at: !article.published ? new Date().toISOString() : null,
        })
        .eq("id", article.id);
      if (error) throw error;
      toast.success(article.published ? "Article unpublished." : "Article published.");
      load();
    } catch (err) {
      console.error("[admin/news] toggle publish error", err);
      toast.error("Failed to update article status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(article: NewsArticle) {
    if (!confirm("Delete this article? This cannot be undone.")) return;
    setBusyId(article.id.toString());
    try {
      const { error } = await supabase
        .from("news_articles")
        .delete()
        .eq("id", article.id);
      if (error) throw error;
      toast.success("Article deleted.");
      load();
    } catch (err) {
      console.error("[admin/news] delete error", err);
      toast.error("Failed to delete article.");
    } finally {
      setBusyId(null);
    }
  }

  if (role && !["admin", "editor"].includes(role)) {
    return <div className="text-muted-foreground">You don't have access to news articles.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News Articles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and publish club news and updates.</p>
        </div>
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Article
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingArticle ? "Edit Article" : "Create News Article"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Article title"
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="article-title"
                />
              </div>
              <div>
                <Label htmlFor="excerpt">Excerpt (280 chars)</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value.slice(0, 280) })}
                  placeholder="Brief summary..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="body">Article Content *</Label>
                <Textarea
                  id="body"
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  placeholder="Full article content..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="coverImage">Cover Image URL</Label>
                <Input
                  id="coverImage"
                  value={formData.cover_image_url}
                  onChange={(e) => setFormData({ ...formData, cover_image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) => setFormData({ ...formData, published: checked === true })}
                />
                <Label htmlFor="published" className="cursor-pointer">Published (visible to public)</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveArticle} disabled={busyId === "save"} className="flex-1">
                  {editingArticle ? "Update" : "Create"} Article
                </Button>
                <Button variant="outline" onClick={handleCloseDialog} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Published</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles === null && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {articles?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                  No articles yet.
                </TableCell>
              </TableRow>
            )}
            {articles?.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold text-foreground">{a.title}</TableCell>
                <TableCell>
                  <Badge variant={a.published ? "default" : "outline"}>
                    {a.published ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleOpenDialog(a)}
                      title="Edit"
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePublish(a)}
                      disabled={busyId === a.id.toString()}
                      title={a.published ? "Unpublish" : "Publish"}
                      className={`p-1 transition-colors disabled:opacity-50 ${a.published ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(a)}
                      disabled={busyId === a.id.toString()}
                      title="Delete"
                      className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
