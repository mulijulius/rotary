import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlbumsManager } from "@/components/admin/gallery/AlbumsManager";
import { SlideshowManager } from "@/components/admin/gallery/SlideshowManager";
import { VideosManager } from "@/components/admin/gallery/VideosManager";

export const Route = createFileRoute("/admin/gallery")({
  component: AdminGallery,
});

function AdminGallery() {
  const { role } = useAuth();

  if (role && !["admin", "editor"].includes(role)) {
    return (
      <div className="text-muted-foreground">You don't have access to gallery management.</div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage photo albums, the home page slideshow, and the video library.
        </p>
      </div>

      <Tabs defaultValue="albums" className="mt-6">
        <TabsList>
          <TabsTrigger value="albums">Albums</TabsTrigger>
          <TabsTrigger value="slideshow">Slideshow</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
        </TabsList>
        <TabsContent value="albums" className="mt-6">
          <AlbumsManager />
        </TabsContent>
        <TabsContent value="slideshow" className="mt-6">
          <SlideshowManager />
        </TabsContent>
        <TabsContent value="videos" className="mt-6">
          <VideosManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
