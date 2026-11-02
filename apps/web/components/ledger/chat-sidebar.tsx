"use client";

import type { ChatThreadSummary } from "@cashow/services";
import {
  Ellipsis,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface ChatSidebarProps {
  threads: ChatThreadSummary[];
  activeThreadId: string | null;
  isLoading: boolean;
  onSelectThread: (threadId: string) => void;
  onNewChat: () => void;
  onRenameThread: (threadId: string, newTitle: string) => Promise<void>;
  onToggleFavorite: (threadId: string, isFavorite: boolean) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  className?: string;
  onCloseMobile?: () => void;
}

export function ChatSidebar({
  threads,
  activeThreadId,
  isLoading,
  onSelectThread,
  onNewChat,
  onRenameThread,
  onToggleFavorite,
  onDeleteThread,
  className,
  onCloseMobile,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [renamingThread, setRenamingThread] = useState<ChatThreadSummary | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);
  const [deletingThread, setDeletingThread] = useState<ChatThreadSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase().trim();
    return threads.filter(
      (t) => t.title?.toLowerCase().includes(q) || t.lastMessageSnippet?.toLowerCase().includes(q),
    );
  }, [threads, search]);

  const favorites = useMemo(() => filteredThreads.filter((t) => t.isFavorite), [filteredThreads]);

  const recents = useMemo(() => filteredThreads.filter((t) => !t.isFavorite), [filteredThreads]);

  function openRename(thread: ChatThreadSummary) {
    setRenamingThread(thread);
    setRenameInput(thread.title || "Percakapan Baru");
  }

  async function handleSaveRename() {
    if (!renamingThread) return;
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    setIsSubmittingRename(true);
    try {
      await onRenameThread(renamingThread.id, trimmed);
      setRenamingThread(null);
    } finally {
      setIsSubmittingRename(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deletingThread) return;
    setIsDeleting(true);
    try {
      await onDeleteThread(deletingThread.id);
      setDeletingThread(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleSelect(id: string) {
    onSelectThread(id);
    onCloseMobile?.();
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex h-full w-72 flex-col border-r border-border/70 bg-card/60 backdrop-blur-md select-none",
          className,
        )}
      >
        {/* Header & New Chat button */}
        <div className="flex flex-col gap-2.5 p-3.5 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold tracking-tight text-foreground uppercase">
                Riwayat Sesi
              </span>
              <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 font-mono">
                {threads.length}
              </Badge>
            </div>
            {onCloseMobile && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={onCloseMobile}
                className="size-7 sm:hidden text-muted-foreground hover:text-foreground"
                aria-label="Tutup panel"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>

          <Button
            type="button"
            onClick={() => {
              onNewChat();
              onCloseMobile?.();
            }}
            size="sm"
            className="w-full justify-start shadow-2xs font-medium"
          >
            <Plus data-icon="inline-start" aria-hidden="true" />
            <span>Percakapan Baru</span>
          </Button>

          {/* Search Input */}
          {threads.length > 3 && (
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/70"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari sesi percakapan..."
                className="h-8 pl-8 pr-7 text-xs bg-muted/40 border-border/60 rounded-lg placeholder:text-muted-foreground/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Hapus pencarian"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Sessions List Content */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          {isLoading && threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-xs">Memuat sesi...</span>
            </div>
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-muted-foreground gap-1.5">
              <MessageSquare className="size-6 text-muted-foreground/50 stroke-1" />
              <p className="text-xs font-medium text-foreground">Belum ada percakapan</p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Ketik pertanyaan di kolom chat untuk memulai sesi pertama Anda.
              </p>
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              Tidak ada sesi yang cocok dengan "{search}".
            </div>
          ) : (
            <>
              {/* Favorites Section */}
              {favorites.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-amber-500/90 uppercase tracking-wider">
                    <Star className="size-3 fill-amber-500 text-amber-500" />
                    <span>Favorit</span>
                  </div>
                  <div className="space-y-0.5">
                    {favorites.map((t) => (
                      <ThreadRow
                        key={t.id}
                        thread={t}
                        isActive={t.id === activeThreadId}
                        onSelect={() => handleSelect(t.id)}
                        onRename={() => openRename(t)}
                        onToggleFavorite={() => onToggleFavorite(t.id, !t.isFavorite)}
                        onDelete={() => setDeletingThread(t)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Recents Section */}
              {recents.length > 0 && (
                <div className="space-y-1">
                  {favorites.length > 0 && (
                    <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <span>Riwayat</span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {recents.map((t) => (
                      <ThreadRow
                        key={t.id}
                        thread={t}
                        isActive={t.id === activeThreadId}
                        onSelect={() => handleSelect(t.id)}
                        onRename={() => openRename(t)}
                        onToggleFavorite={() => onToggleFavorite(t.id, !t.isFavorite)}
                        onDelete={() => setDeletingThread(t)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rename Dialog */}
        <Dialog
          open={renamingThread !== null}
          onOpenChange={(open) => !open && setRenamingThread(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Ubah Nama Percakapan</DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <Input
                value={renameInput}
                onChange={(e) => setRenameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveRename();
                  }
                }}
                maxLength={80}
                placeholder="Masukkan judul sesi..."
                className="text-sm"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRenamingThread(null)}
                disabled={isSubmittingRename}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveRename}
                disabled={isSubmittingRename || !renameInput.trim()}
              >
                {isSubmittingRename ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog
          open={deletingThread !== null}
          onOpenChange={(open) => !open && setDeletingThread(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Percakapan?</AlertDialogTitle>
              <AlertDialogDescription>
                Percakapan "
                <strong className="font-semibold break-all text-foreground">
                  {deletingThread?.title || "Percakapan Ini"}
                </strong>
                " beserta seluruh riwayat analisis keuangannya akan dihapus permanen. Tindakan ini
                tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Menghapus..." : "Hapus Percakapan"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

function ThreadRow({
  thread,
  isActive,
  onSelect,
  onRename,
  onToggleFavorite,
  onDelete,
}: {
  thread: ChatThreadSummary;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const displayTitle = thread.title || "Percakapan Baru";

  return (
    <div
      className={cn(
        "group relative flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex items-center gap-2 min-w-0 pr-1 flex-1 text-left cursor-pointer focus:outline-none"
      >
        {thread.isFavorite ? (
          <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden="true" />
        ) : (
          <MessageSquare
            className={cn(
              "size-3.5 shrink-0 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground/80",
            )}
            aria-hidden="true"
          />
        )}
        <span className="truncate flex-1">{displayTitle}</span>
        {thread.messageCount > 0 && (
          <span
            className={cn(
              "text-[10px] font-mono px-1 rounded-sm shrink-0 transition-colors",
              isActive
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/60 group-hover:text-muted-foreground",
            )}
          >
            {thread.messageCount}
          </span>
        )}
      </button>

      {/* Action Strip (Three-Dots Menu) */}
      <div
        className={cn(
          "flex items-center gap-0.5 shrink-0 transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
        )}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onToggleFavorite}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label={thread.isFavorite ? "Hapus dari favorit" : "Tandai favorit"}
              />
            }
          >
            <Star
              className={cn(
                "size-3.5",
                thread.isFavorite
                  ? "fill-amber-500 text-amber-500"
                  : "text-muted-foreground hover:text-amber-500",
              )}
            />
          </TooltipTrigger>
          <TooltipContent side="top">
            {thread.isFavorite ? "Hapus dari favorit" : "Tandai favorit"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Menu opsi percakapan"
              />
            }
          >
            <Ellipsis className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-xs">
            <DropdownMenuItem onClick={onRename} className="gap-2 cursor-pointer">
              <Pencil className="size-3.5" />
              <span>Ubah Nama</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleFavorite} className="gap-2 cursor-pointer">
              <Star
                className={cn("size-3.5", thread.isFavorite && "fill-amber-500 text-amber-500")}
              />
              <span>{thread.isFavorite ? "Hapus Favorit" : "Jadikan Favorit"}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              variant="destructive"
              className="gap-2 cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Hapus Percakapan</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
