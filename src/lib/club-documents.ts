// Document upload helpers backed by the private `club-documents` storage
// bucket (see 20260826_017_officer_and_invoice_documents.sql). Unlike
// content-photos.ts (`club-photos`, a *public* bucket), this bucket is
// private: files are never resolved with getPublicUrl. Only the storage
// object *path* is ever persisted on a row; a viewable link is minted on
// demand with a short-lived signed URL. Only officers (admin/treasurer/
// secretary/editor) can write here — enforced by storage RLS, not just
// this file — so this is the client-side shape, not the actual security
// boundary. Any signed-in member can read/download, so documents raised
// here are reachable by other people in the portal later, not just the
// uploader.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type BoardPositionDocument = Database["public"]["Tables"]["board_position_documents"]["Row"];

const MAX_BYTES = 15 * 1024 * 1024; // 15MB — enough for a scanned receipt or a set of typed minutes

function assertValidDocument(file: File) {
  if (file.size > MAX_BYTES) {
    throw new Error("File must be under 15MB.");
  }
}

function extensionOf(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

// Uploads a single file into `club-documents` under the given folder and
// returns the object path (NOT a URL — this bucket is private). Folder
// examples: "invoices/INV-260826123456-42", "board-positions/7".
export async function uploadClubDocument(folder: string, file: File): Promise<string> {
  assertValidDocument(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extensionOf(file.name)}`;
  const { error } = await supabase.storage.from("club-documents").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

// Mints a short-lived signed URL for viewing/downloading a previously
// uploaded document. Call this right before opening the link — do not
// cache the result, it expires.
export async function getClubDocumentUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from("club-documents").createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteClubDocumentByPath(path: string): Promise<void> {
  const { error } = await supabase.storage.from("club-documents").remove([path]);
  if (error) console.error("[club-documents] failed to delete storage object", error);
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------
// Per-official documents (board_position_documents) — meeting minutes,
// handover notes, and other club documents filed under a specific board
// position for a fiscal year (President, Secretary, Treasurer, etc.)
// ---------------------------------------------------------------------

export async function fetchBoardPositionDocuments(boardPositionId: number): Promise<BoardPositionDocument[]> {
  const { data, error } = await supabase
    .from("board_position_documents")
    .select("*")
    .eq("board_position_id", boardPositionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function addBoardPositionDocument(
  boardPositionId: number,
  file: File,
  title: string,
  uploadedBy: string | null,
): Promise<BoardPositionDocument> {
  const path = await uploadClubDocument(`board-positions/${boardPositionId}`, file);
  const { data, error } = await supabase
    .from("board_position_documents")
    .insert({
      board_position_id: boardPositionId,
      title,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: uploadedBy,
    })
    .select("*")
    .single();
  if (error) {
    // Row insert failed after the file already landed in storage — clean
    // up the orphaned object rather than leaving it unreferenced.
    await deleteClubDocumentByPath(path);
    throw error;
  }
  return data;
}

export async function deleteBoardPositionDocument(doc: BoardPositionDocument): Promise<void> {
  const { error } = await supabase.from("board_position_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await deleteClubDocumentByPath(doc.file_path);
}
