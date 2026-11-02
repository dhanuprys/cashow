"use client";

import { useChat } from "@ai-sdk/react";
import type { ChatThreadSummary } from "@cashow/services";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  ExternalLink,
  Key,
  Loader2,
  PanelLeft,
  PanelLeftClose,
  PieChart,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatApprovalCard } from "@/components/ledger/chat-approval-card";
import { ChatMarkdown } from "@/components/ledger/chat-markdown";
import { ChatSidebar } from "@/components/ledger/chat-sidebar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Message, MessageContent } from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getFollowUpSuggestions, getMessageSourceLinks } from "@/lib/ai-suggestions";
import { cn } from "@/lib/utils";

interface AvailableModel {
  id: string;
  name: string;
  connectionId?: string;
  connectionName?: string;
  provider: "GOOGLE" | "DEEPSEEK" | "OPENAI" | "OPENAI_COMPATIBLE";
  model: string;
  label?: string;
  isDefault: boolean;
  isSystem: boolean;
}

const PROMPT_SUGGESTIONS = [
  {
    icon: Wallet,
    title: "Total Saldo & Rekening",
    description: "Hitung total saldo kas, tabungan bank, dan dompet digital terkini.",
    prompt: "Berapa total saldo saya di seluruh rekening dan dompet digital saat ini?",
  },
  {
    icon: PieChart,
    title: "Evaluasi Status Anggaran",
    description: "Cek kategori yang pengeluarannya mendekati atau melampaui limit.",
    prompt:
      "Bagaimana status anggaran saya bulan ini? Apakah ada kategori yang sudah melampaui batas?",
  },
  {
    icon: TrendingUp,
    title: "Pengeluaran Terbesar",
    description: "Tampilkan transaksi paling signifikan yang banyak menghabiskan dana.",
    prompt: "Tampilkan 5 pengeluaran terbesar saya bulan ini beserta kategori dan tanggalnya.",
  },
  {
    icon: ShieldCheck,
    title: "Batas Aman Belanja Harian",
    description: "Hitung alokasi dana bebas yang aman dibelanjakan hari ini (Safe-to-Spend).",
    prompt: "Berapa batas aman uang bebas (Safe-to-Spend) yang bisa saya belanjakan hari ini?",
  },
];

const TOOL_DESCRIPTIONS: Record<string, string> = {
  getAccountBalances: "Memeriksa saldo rekening & kas",
  getSpendingSummary: "Menghitung ringkasan & pola pengeluaran",
  listCategories: "Melihat daftar kategori keuangan",
  getPendingRecurringDrafts: "Mengecek tagihan berulang yang menunggu konfirmasi",
  getBudgetStatus: "Mengevaluasi alokasi batas anggaran",
  getSafeToSpend: "Menghitung batas aman pengeluaran harian",
  searchTransactions: "Mencari catatan mutasi keuangan",
  getRecentTransactions: "Mengambil daftar transaksi terbaru",
  getPlans: "Mengecek rencana keuangan masa depan",
  getRecurringTemplates: "Melihat jadwal tagihan rutin berulang",
  createTransaction: "Mencatat transaksi ke buku kas",
  createTransfer: "Mencatat transfer antar rekening",
};

export default function ChatPage() {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [modelsState, setModelsState] = useState<"loading" | "ready" | "error">("loading");

  // Multi-session state
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoadingThreads, setIsLoadingThreads] = useState<boolean>(true);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState<boolean>(false);
  const activeThreadIdRef = useRef<string>("");

  // Mobile chrome: the composer height and the software-keyboard occlusion.
  // Both are measured so the transcript and the jump button can stay clear.
  const [formHeight, setFormHeight] = useState(88);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const selectedModelRef = useRef<string>("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        prepareSendMessagesRequest: ({ body, messages, ...rest }) => ({
          ...rest,
          body: {
            messages,
            ...body,
            configId: selectedModelRef.current || undefined,
            threadId: activeThreadIdRef.current || undefined,
          },
        }),
      }),
    [],
  );

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/threads");
      if (!res.ok) return;
      const data = (await res.json()) as { threads?: ChatThreadSummary[] };
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingThreads(false);
    }
  }, []);

  const {
    messages,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
    regenerate,
    stop,
    clearError,
  } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (err) => {
      console.error("[chat] stream error:", err);
    },
    onFinish: () => {
      void loadThreads();
    },
  });

  const isGenerating = status === "submitted" || status === "streaming";
  const hasRegisteredModels = availableModels.length > 0;
  const isLoadingModels = modelsState === "loading";
  const followUpSuggestions = useMemo(
    () => (isGenerating ? [] : getFollowUpSuggestions(messages)),
    [isGenerating, messages],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId);
      activeThreadIdRef.current = threadId;

      const url = new URL(window.location.href);
      url.searchParams.set("thread", threadId);
      window.history.replaceState({}, "", url.toString());

      try {
        const res = await fetch(`/api/chat/threads/${threadId}`);
        if (!res.ok) return;
        // Check if the user hasn't switched to another thread while this was fetching
        if (activeThreadIdRef.current !== threadId) return;

        const data = (await res.json()) as {
          thread?: ChatThreadSummary;
          messages?: Array<{
            id: string;
            role: "user" | "assistant" | "system";
            content: string;
            parts?: unknown;
          }>;
        };

        if (data.thread && Array.isArray(data.messages)) {
          const formatted: UIMessage[] = data.messages.map((m) => ({
            id: m.id,
            role: m.role,
            parts:
              Array.isArray(m.parts) && m.parts.length > 0
                ? (m.parts as UIMessage["parts"])
                : [{ type: "text" as const, text: m.content }],
          }));
          setMessages(formatted);

          if (data.thread.modelId) {
            setSelectedModelId(data.thread.modelId);
            selectedModelRef.current = data.thread.modelId;
          }
        }
      } catch {
        toast.add({ title: "Gagal", description: "Gagal memuat sesi percakapan." });
      }
    },
    [setMessages],
  );

  function handleNewChat() {
    setActiveThreadId(null);
    activeThreadIdRef.current = "";
    setMessages([]);
    clearError();
    const url = new URL(window.location.href);
    url.searchParams.delete("thread");
    window.history.replaceState({}, "", url.toString());
  }

  async function handleRenameThread(threadId: string, newTitle: string) {
    try {
      const res = await fetch(`/api/chat/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) throw new Error("Gagal mengubah nama.");
      const data = (await res.json()) as { thread: ChatThreadSummary };
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, title: data.thread.title } : t)),
      );
      toast.add({ title: "Tersimpan", description: "Nama percakapan berhasil diubah." });
    } catch {
      toast.add({ title: "Gagal", description: "Gagal mengubah nama percakapan." });
    }
  }

  async function handleToggleFavorite(threadId: string, isFavorite: boolean) {
    setThreads((prev) => {
      const updated = prev.map((t) => (t.id === threadId ? { ...t, isFavorite } : t));
      return [...updated].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return String(b.updatedAt).localeCompare(String(a.updatedAt));
      });
    });

    try {
      const res = await fetch(`/api/chat/threads/${threadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan status favorit.");
      toast.add({
        title: isFavorite ? "Ditambahkan ke Favorit" : "Dihapus dari Favorit",
        description: isFavorite ? "Percakapan disematkan di bagian atas." : undefined,
      });
    } catch {
      void loadThreads();
      toast.add({ title: "Gagal", description: "Gagal memperbarui status favorit." });
    }
  }

  async function handleDeleteThread(threadId: string) {
    try {
      const res = await fetch(`/api/chat/threads/${threadId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus percakapan.");
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      if (activeThreadId === threadId) {
        handleNewChat();
      }
      toast.add({ title: "Terhapus", description: "Percakapan berhasil dihapus." });
    } catch {
      toast.add({ title: "Gagal", description: "Gagal menghapus percakapan." });
    }
  }

  const loadModels = useCallback(() => {
    setModelsState("loading");
    fetch("/api/chat")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ models?: AvailableModel[]; defaultId?: string | null }>;
      })
      .then((data) => {
        if (!data.models || data.models.length === 0) {
          setAvailableModels([]);
          setSelectedModelId("");
          selectedModelRef.current = "";
          setModelsState("ready");
          return;
        }

        setAvailableModels(data.models);

        let saved: string | null = null;
        try {
          saved = localStorage.getItem("cashow_ai_model_id");
        } catch {
          // Private mode or blocked storage: fall back to the server default.
        }
        const matched = saved && data.models.some((m) => m.id === saved) ? saved : null;
        const initialId = matched ?? data.defaultId ?? data.models[0].id;
        setSelectedModelId(initialId);
        selectedModelRef.current = initialId;
        setModelsState("ready");
      })
      .catch(() => {
        setModelsState("error");
      });
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      loadModels();
      setIsLoadingThreads(true);
      try {
        const res = await fetch("/api/chat/threads");
        if (!res.ok || !isMounted) return;
        const data = (await res.json()) as { threads?: ChatThreadSummary[] };
        const loadedThreads: ChatThreadSummary[] = Array.isArray(data.threads) ? data.threads : [];
        setThreads(loadedThreads);

        const params = new URLSearchParams(window.location.search);
        const urlThreadId = params.get("thread");

        if (urlThreadId && loadedThreads.some((t) => t.id === urlThreadId)) {
          await selectThread(urlThreadId);
        } else if (loadedThreads.length > 0) {
          // Resume latest active session
          await selectThread(loadedThreads[0].id);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setIsLoadingThreads(false);
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [loadModels, selectThread]);

  useEffect(() => {
    const form = formRef.current;
    if (form === null) return;
    const observer = new ResizeObserver(() => setFormHeight(form.offsetHeight));
    observer.observe(form);
    setFormHeight(form.offsetHeight);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport === null) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      // Only a real keyboard is this tall; ignore browser-toolbar shifts.
      setKeyboardInset(inset > 120 ? Math.round(inset) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  function handleModelChange(newId: string) {
    if (newId === "__manage_settings__") {
      router.push("/app/settings#ai-models");
      return;
    }
    setSelectedModelId(newId);
    selectedModelRef.current = newId;
    // Clear any stale error from the previous model.
    clearError();
    try {
      localStorage.setItem("cashow_ai_model_id", newId);
    } catch {
      // LocalStorage error ignored
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  }

  useEffect(() => {
    if (copiedId === null) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  function handleCopy(id: string, text: string) {
    if (navigator?.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedId(id);
    }
  }

  async function submitMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (trimmed === "" || isGenerating) return;
    if (isLoadingModels) return;
    if (modelsState === "error") {
      loadModels();
      return;
    }
    if (!hasRegisteredModels) {
      router.push("/app/settings#ai-models");
      return;
    }

    // If no active thread yet, create one before sending
    if (!activeThreadIdRef.current) {
      try {
        const res = await fetch("/api/chat/threads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: selectedModelRef.current || undefined,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { thread: ChatThreadSummary };
          if (data.thread?.id) {
            setActiveThreadId(data.thread.id);
            activeThreadIdRef.current = data.thread.id;
            const url = new URL(window.location.href);
            url.searchParams.set("thread", data.thread.id);
            window.history.replaceState({}, "", url.toString());
            setThreads((prev) => [data.thread, ...prev]);
          }
        }
      } catch {
        // Fallback
      }
    }

    sendMessage({ text: trimmed });
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void submitMessage(input);
  }

  const selectedModel = availableModels.find((m) => m.id === selectedModelId);
  const groupedModels = useMemo(() => {
    const groups: Record<string, AvailableModel[]> = {};
    for (const m of availableModels) {
      const groupName = m.connectionName || m.provider;
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(m);
    }
    return groups;
  }, [availableModels]);

  const activeThread = threads.find((t) => t.id === activeThreadId);
  // Keep the jump-to-bottom button above the composer on phones, and let the
  // transcript padding grow with the software keyboard.
  const jumpBottom = formHeight + (keyboardInset > 0 ? 20 : 80) + keyboardInset;

  return (
    <TooltipProvider>
      <div className="relative flex size-full min-h-0 flex-1 overflow-hidden">
        {/* Desktop Collapsible Sidebar */}
        {isDesktopSidebarOpen && (
          <div className="hidden md:flex shrink-0 h-full">
            <ChatSidebar
              threads={threads}
              activeThreadId={activeThreadId}
              isLoading={isLoadingThreads}
              onSelectThread={selectThread}
              onNewChat={handleNewChat}
              onRenameThread={handleRenameThread}
              onToggleFavorite={handleToggleFavorite}
              onDeleteThread={handleDeleteThread}
            />
          </div>
        )}

        {/* Mobile Sheet Drawer */}
        <Sheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen}>
          <SheetContent side="left" showCloseButton={false} className="p-0 w-72 sm:w-80">
            <ChatSidebar
              threads={threads}
              activeThreadId={activeThreadId}
              isLoading={isLoadingThreads}
              onSelectThread={selectThread}
              onNewChat={handleNewChat}
              onRenameThread={handleRenameThread}
              onToggleFavorite={handleToggleFavorite}
              onDeleteThread={handleDeleteThread}
              onCloseMobile={() => setIsMobileSheetOpen(false)}
              className="w-full border-r-0"
            />
          </SheetContent>
        </Sheet>

        {/* Main Chat Canvas Area */}
        <div
          data-chat-page=""
          style={
            {
              "--jump-bottom": `calc(${jumpBottom}px + env(safe-area-inset-bottom))`,
              "--keyboard-inset": `${keyboardInset}px`,
            } as CSSProperties
          }
          className="relative flex size-full min-h-0 flex-1 flex-col overflow-hidden"
        >
          {/* Top Session Action Bar */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 backdrop-blur-md z-10">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsDesktopSidebarOpen((prev) => !prev)}
                className="hidden md:inline-flex text-muted-foreground hover:text-foreground"
                aria-label={
                  isDesktopSidebarOpen ? "Sembunyikan bilah sisi" : "Tampilkan bilah sisi"
                }
              >
                {isDesktopSidebarOpen ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeft className="size-4" />
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setIsMobileSheetOpen(true)}
                className="inline-flex md:hidden text-muted-foreground hover:text-foreground"
                aria-label="Buka riwayat percakapan"
              >
                <PanelLeft className="size-4" />
              </Button>

              <div className="h-4 w-px bg-border/60" />

              <div className="flex items-center gap-1.5 min-w-0">
                {activeThread?.isFavorite && (
                  <Star
                    className="size-3.5 shrink-0 fill-amber-500 text-amber-500"
                    aria-hidden="true"
                  />
                )}
                <span className="truncate text-xs font-semibold text-foreground">
                  {activeThread?.title ||
                    (messages.length > 0 ? "Percakapan Saat Ini" : "Percakapan Baru")}
                </span>
                {activeThread && (
                  <Badge
                    variant="outline"
                    className="hidden sm:inline-flex text-[10px] h-4.5 px-1.5 text-muted-foreground font-mono"
                  >
                    {messages.length} pesan
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                className="text-muted-foreground hover:text-foreground"
              >
                <Plus data-icon="inline-start" aria-hidden="true" />
                <span className="hidden sm:inline">Percakapan Baru</span>
              </Button>
            </div>
          </div>

          <MessageScrollerProvider autoScroll>
            <MessageScroller className="relative min-h-0 flex-1 w-full">
              <MessageScrollerViewport className="w-full px-4 pt-4 pb-[calc(15rem+var(--keyboard-inset,0px)+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 sm:pb-48">
                <MessageScrollerContent className="mx-auto max-w-3xl w-full gap-5 sm:gap-6">
                  {/* Empty State Hero & Starter Prompts */}
                  {messages.length === 0 ? (
                    isLoadingModels ? (
                      /* Waiting for the model list before choosing a state */
                      <div
                        className="my-auto flex flex-col items-center justify-center gap-3 py-16 text-center"
                        role="status"
                        aria-live="polite"
                      >
                        <Loader2
                          className="size-5 animate-spin text-muted-foreground"
                          aria-hidden="true"
                        />
                        <p className="text-xs text-muted-foreground">
                          Memuat konfigurasi model AI…
                        </p>
                      </div>
                    ) : modelsState === "error" ? (
                      /* The list request failed: offer a retry instead of pretending no key exists */
                      <div
                        className="my-auto flex max-w-md flex-col items-center justify-center gap-4 py-12 text-center"
                        role="alert"
                      >
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                          <AlertCircle className="size-6" aria-hidden="true" />
                        </div>
                        <div className="space-y-1">
                          <h2 className="font-heading text-lg font-semibold tracking-tight">
                            Gagal memuat model AI
                          </h2>
                          <p className="text-xs text-muted-foreground">
                            Periksa koneksi Anda lalu coba lagi. Konfigurasi Anda tetap tersimpan.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={loadModels}
                          className="gap-1.5"
                        >
                          <RefreshCw className="size-3.5" aria-hidden="true" />
                          Coba lagi
                        </Button>
                      </div>
                    ) : !hasRegisteredModels ? (
                      /* Minimalist Clean Setup Prompt */
                      <div className="my-auto mx-auto flex max-w-sm flex-col items-center justify-center space-y-4 py-8 text-center sm:py-16">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-muted/60 text-foreground/80 ring-1 ring-border/80 shadow-2xs">
                          <Key className="size-5 text-muted-foreground" aria-hidden="true" />
                        </div>

                        <div className="space-y-1.5 px-4">
                          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                            Hubungkan Model AI
                          </h2>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Mulai konsultasi keuangan pribadi dengan menambahkan kunci API dari
                            Google Gemini, DeepSeek, atau OpenAI.
                          </p>
                        </div>

                        <div className="pt-1">
                          <Link
                            href="/app/settings#ai-models"
                            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-2xs transition-all hover:bg-primary/90 active:scale-95"
                          >
                            <span>Buka Pengaturan Model</span>
                            <ArrowRight className="size-3.5 opacity-80" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>
                    ) : (
                      /* Minimalist Starter State */
                      <div className="my-auto flex flex-col items-center justify-center space-y-6 py-8 text-center sm:py-14">
                        <div className="max-w-sm space-y-1.5 px-4">
                          <h2 className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                            Ada yang ingin dianalisis?
                          </h2>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Pilih pertanyaan pembuka atau ketik langsung kebutuhan Anda.
                          </p>
                        </div>

                        {/* Minimalist Starter Chips */}
                        <div className="flex w-full max-w-lg flex-wrap justify-center gap-1.5 px-2">
                          {PROMPT_SUGGESTIONS.map((item) => (
                            <button
                              key={item.title}
                              type="button"
                              disabled={isGenerating}
                              onClick={() => submitMessage(item.prompt)}
                              className="group inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-foreground/20 hover:bg-muted/60 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="font-medium text-foreground/90 group-hover:text-foreground">
                                {item.title}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  ) : null}

                  {/* Messages Timeline */}
                  {messages.map((message) => {
                    const isUser = message.role === "user";
                    const text = message.parts
                      .filter((p) => p.type === "text")
                      .map((p) => p.text)
                      .join("");
                    const toolParts = message.parts.filter(isToolUIPart);
                    const hasPendingApproval = toolParts.some(
                      (part) => part.state === "approval-requested",
                    );
                    const isLastMessage = message.id === messages[messages.length - 1]?.id;
                    const sourceLinks = getMessageSourceLinks(message);

                    return (
                      <MessageScrollerItem key={message.id} messageId={message.id}>
                        {isUser ? (
                          /* User Message Bubble */
                          <Message align="end">
                            <MessageContent className="items-end">
                              <Bubble variant="default" align="end">
                                <BubbleContent className="rounded-2xl rounded-tr-xs bg-primary text-primary-foreground font-normal whitespace-pre-wrap shadow-2xs selection:bg-primary-foreground selection:text-primary">
                                  {text}
                                </BubbleContent>
                              </Bubble>
                            </MessageContent>
                          </Message>
                        ) : (
                          /* Assistant Message Flow */
                          <Message align="start" className="w-full">
                            <MessageContent className="w-full gap-2.5">
                              {/* Assistant Header & Actions */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className="relative flex size-5.5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted/40">
                                    <Image
                                      src="/logo.png"
                                      alt="Cashow"
                                      width={20}
                                      height={20}
                                      className="size-4 shrink-0 object-contain"
                                    />
                                  </div>
                                  <span className="font-semibold text-xs text-foreground">
                                    Cashow
                                  </span>
                                </div>

                                {/* Actions: Copy & Regenerate */}
                                {text !== "" && (
                                  <div className="flex items-center gap-1 text-muted-foreground opacity-90 transition-opacity">
                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label={
                                              copiedId === message.id ? "Tersalin" : "Salin jawaban"
                                            }
                                            onClick={() => handleCopy(message.id, text)}
                                            className="size-9 sm:size-7"
                                          />
                                        }
                                      >
                                        {copiedId === message.id ? (
                                          <Check className="size-3.5 text-emerald-600 sm:size-3 dark:text-emerald-400" />
                                        ) : (
                                          <Copy className="size-3.5 sm:size-3" />
                                        )}
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">
                                        {copiedId === message.id ? "Tersalin" : "Salin"}
                                      </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger
                                        render={
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-xs"
                                            aria-label="Buat ulang jawaban"
                                            disabled={isGenerating}
                                            onClick={() => void regenerate()}
                                            className="size-9 sm:size-7"
                                          />
                                        }
                                      >
                                        <RotateCcw className="size-3.5 sm:size-3" />
                                      </TooltipTrigger>
                                      <TooltipContent side="bottom">Buat ulang</TooltipContent>
                                    </Tooltip>
                                  </div>
                                )}
                              </div>

                              {/* Write tools wait for an explicit click before running. */}
                              {toolParts.map((tp) => {
                                if (tp.state !== "approval-requested" || !isLastMessage)
                                  return null;
                                return (
                                  <ChatApprovalCard
                                    key={`approval-${tp.toolCallId}`}
                                    part={tp}
                                    disabled={!isLastMessage}
                                    onRespond={(approvalId, approved) => {
                                      addToolApprovalResponse({ id: approvalId, approved });
                                    }}
                                  />
                                );
                              })}

                              {/* Tool Call Activity Trace - Minimalist Compact Badge */}
                              {toolParts.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] text-muted-foreground">
                                  {toolParts.map((tp, idx) => {
                                    if (tp.state === "approval-requested") return null;
                                    const toolName = getToolName(tp);
                                    const statusLabel =
                                      tp.state === "output-denied"
                                        ? "Dibatalkan"
                                        : tp.state === "approval-responded"
                                          ? tp.approval.approved
                                            ? "Disetujui"
                                            : "Dibatalkan"
                                          : null;
                                    const desc =
                                      statusLabel ?? TOOL_DESCRIPTIONS[toolName] ?? toolName;
                                    const callKey =
                                      "toolCallId" in tp && typeof tp.toolCallId === "string"
                                        ? tp.toolCallId
                                        : `${toolName}-${idx}`;
                                    return (
                                      <span
                                        key={callKey}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground/85"
                                      >
                                        <Wrench className="size-2.5 shrink-0 text-muted-foreground/80" />
                                        <span>{desc}</span>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {/* Markdown text response */}
                              <div className="pl-0.5 text-sm leading-relaxed break-words text-foreground">
                                {text ? (
                                  <ChatMarkdown content={text} />
                                ) : isLastMessage && isGenerating && !hasPendingApproval ? (
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                    <span className="relative flex size-2">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                                    </span>
                                    <span className="shimmer">
                                      Sedang menganalisis data buku kas Anda…
                                    </span>
                                  </div>
                                ) : null}
                              </div>

                              {/* Source Verification Chips */}
                              {sourceLinks.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-0.5">
                                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground/70">
                                    Sumber:
                                  </span>
                                  {sourceLinks.map((source) => (
                                    <Link
                                      key={source.key}
                                      href={source.href}
                                      className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/80 hover:text-foreground"
                                    >
                                      <span>{source.label}</span>
                                      <ExternalLink
                                        className="size-2.5 opacity-60"
                                        aria-hidden="true"
                                      />
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </MessageContent>
                          </Message>
                        )}
                      </MessageScrollerItem>
                    );
                  })}

                  {/* Immediate Loading indicator right after user sent a message */}
                  {isGenerating && !error && messages[messages.length - 1]?.role === "user" && (
                    <div
                      className="flex items-center gap-2.5 text-xs text-muted-foreground py-2 pl-1"
                      role="status"
                      aria-live="polite"
                    >
                      <span className="relative flex size-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex size-2 rounded-full bg-primary" />
                      </span>
                      <span className="animate-pulse">Menghubungkan ke asisten keuangan…</span>
                    </div>
                  )}

                  {/* Error Banner */}
                  {error !== undefined ? (
                    <Alert
                      variant="destructive"
                      className="sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                        <AlertDescription className="text-xs">
                          {error.message ||
                            "Gagal memuat respon AI. Silakan periksa konfigurasi API token atau kuota Anda."}
                        </AlertDescription>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                        <button
                          type="button"
                          onClick={() => void regenerate()}
                          disabled={isGenerating}
                          className="inline-flex min-h-8 items-center text-xs font-medium underline underline-offset-2 hover:text-foreground disabled:opacity-50 cursor-pointer"
                        >
                          Coba lagi
                        </button>
                        <Link
                          href="/app/settings#ai-models"
                          className="inline-flex min-h-8 items-center text-xs font-medium underline underline-offset-2 hover:text-foreground"
                        >
                          Buka Pengaturan Model
                        </Link>
                      </div>
                    </Alert>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>

              {/* Floating Jump-to-bottom Button (positioned above floating prompt bar) */}
              <MessageScrollerButton className="bottom-[var(--jump-bottom)]! md:bottom-28! z-20 shadow-md" />
            </MessageScroller>
          </MessageScrollerProvider>

          {/* Floating Prompt Input Area with Soft Gradient Fade */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center bg-gradient-to-t from-background via-background/95 to-transparent pt-8 sm:pt-12",
              keyboardInset > 0 ? "pb-2" : "pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-6",
            )}
            style={keyboardInset > 0 ? { bottom: keyboardInset } : undefined}
          >
            <div className="w-full max-w-3xl px-3 sm:px-6">
              {/* Dynamic Follow-Up Prompt Chips */}
              {followUpSuggestions.length > 0 && input.trim() === "" && (
                <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                  {followUpSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.key}
                      type="button"
                      disabled={isGenerating}
                      onClick={() => submitMessage(suggestion.prompt)}
                      className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-2xs backdrop-blur-md transition-all hover:border-foreground/25 hover:bg-muted/80 hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                    >
                      <Sparkles className="size-3 text-primary/70 transition-transform group-hover:scale-110" />
                      <span className="font-medium text-foreground/90 group-hover:text-foreground">
                        {suggestion.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <form
                ref={formRef}
                onSubmit={handleSubmit}
                className="pointer-events-auto relative w-full"
              >
                <div className="relative flex flex-col rounded-2xl sm:rounded-3xl border border-border/80 bg-background/95 shadow-xl shadow-black/5 dark:shadow-black/35 backdrop-blur-xl ring-1 ring-border/50 transition-all focus-within:border-primary/80 focus-within:ring-2 focus-within:ring-primary/20">
                  {/* Auto-expanding Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      // Mobile IMEs report Enter while composing; never send mid-word.
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submitMessage(input);
                      }
                    }}
                    placeholder={
                      hasRegisteredModels
                        ? "Tanyakan sesuatu tentang keuangan Anda..."
                        : isLoadingModels
                          ? "Memuat model AI…"
                          : modelsState === "error"
                            ? "Gagal memuat model. Coba lagi."
                            : "Daftarkan API key di Pengaturan untuk mulai percakapan..."
                    }
                    rows={1}
                    maxLength={4000}
                    enterKeyHint="send"
                    autoComplete="off"
                    autoCapitalize="sentences"
                    aria-label="Tulis pesan untuk asisten AI"
                    className="w-full max-h-28 min-h-11 resize-none border-0 bg-transparent px-4 pt-3 pb-1 text-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 leading-relaxed sm:max-h-36 sm:text-sm"
                  />

                  {/* Bottom Action Strip inside Prompt Box */}
                  <div className="flex items-center justify-between gap-1.5 border-t border-transparent px-2.5 pt-1.5 pb-2 sm:gap-2 sm:px-3 sm:pt-1 sm:pb-2">
                    {/* Left: Bottom Model Selector Pill + Settings + Clear History */}
                    <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                      {hasRegisteredModels ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                type="button"
                                className="flex min-h-9 items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1.5 text-xs text-foreground transition-all hover:border-foreground/20 hover:bg-muted/80 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:py-1 cursor-pointer"
                                aria-label="Pilih model AI"
                              />
                            }
                          >
                            <Cpu className="size-3 shrink-0 text-primary" aria-hidden="true" />
                            <span className="max-w-[6.5rem] truncate font-medium xs:max-w-[8.5rem] sm:max-w-[200px]">
                              {selectedModel
                                ? `${selectedModel.label || selectedModel.model} (${selectedModel.connectionName || selectedModel.name})`
                                : "Pilih Model"}
                            </span>
                            <ChevronDown
                              className="size-3 shrink-0 text-muted-foreground/70"
                              aria-hidden="true"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            side="top"
                            sideOffset={8}
                            className="w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-1.5 shadow-xl border border-border/70 bg-popover/95 backdrop-blur-md"
                          >
                            {Object.entries(groupedModels).map(([groupName, groupList], index) => (
                              <DropdownMenuGroup key={groupName}>
                                {index > 0 && <DropdownMenuSeparator />}
                                <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                                  {groupName}
                                </DropdownMenuLabel>
                                {groupList.map((m) => {
                                  const isSelected = m.id === selectedModelId;
                                  return (
                                    <DropdownMenuItem
                                      key={m.id}
                                      onClick={() => handleModelChange(m.id)}
                                      className={cn(
                                        "flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-xs cursor-pointer transition-colors",
                                        isSelected
                                          ? "bg-primary/10 text-primary font-medium"
                                          : "text-foreground hover:bg-muted/60",
                                      )}
                                    >
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">{m.label || m.model}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          {m.model}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <Check className="size-3.5 shrink-0 text-primary" />
                                      )}
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuGroup>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleModelChange("__manage_settings__")}
                              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Settings2 className="size-3.5 shrink-0" />
                              <span>Kelola &amp; Daftarkan Model...</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : modelsState === "ready" ? (
                        <Link
                          href="/app/settings#ai-models"
                          className="group inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/50 shadow-2xs"
                        >
                          <Key
                            className="size-3 shrink-0 transition-transform group-hover:rotate-12"
                            aria-hidden="true"
                          />
                          <span>+ Daftarkan API Key</span>
                        </Link>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground">
                          {isLoadingModels ? (
                            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                          )}
                          <span>{isLoadingModels ? "Memuat model…" : "Model gagal dimuat"}</span>
                        </div>
                      )}

                      {hasRegisteredModels && (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Link
                                href="/app/settings#ai-models"
                                className="hidden sm:inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                aria-label="Kelola model & token API di Pengaturan"
                              />
                            }
                          >
                            <Settings2 className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Kelola API Key &amp; Model</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Right: Shortcut hint + Send / Stop button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="hidden sm:inline text-[11px] text-muted-foreground/50 select-none">
                        Enter kirim • Shift+Enter baris baru
                      </span>

                      {isGenerating ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="secondary"
                          onClick={() => stop()}
                          className="size-10 rounded-full shadow-xs transition-transform active:scale-95 sm:size-8"
                          aria-label="Hentikan jawaban"
                        >
                          <Square className="size-4 fill-current sm:size-3.5" />
                        </Button>
                      ) : hasRegisteredModels ? (
                        <Button
                          type="submit"
                          size="icon-sm"
                          disabled={input.trim() === ""}
                          className={cn(
                            "size-10 rounded-full shadow-xs transition-all active:scale-95 sm:size-8",
                            input.trim() === ""
                              ? "cursor-not-allowed opacity-30"
                              : "bg-primary text-primary-foreground hover:bg-primary/90",
                          )}
                          aria-label="Kirim pesan"
                        >
                          <ArrowUp className="size-5 sm:size-4" />
                        </Button>
                      ) : isLoadingModels ? (
                        <Button
                          type="button"
                          size="icon-sm"
                          disabled
                          className="size-10 rounded-full opacity-40 sm:size-8"
                          aria-label="Memuat model AI"
                        >
                          <Loader2 className="size-4.5 animate-spin sm:size-4" aria-hidden="true" />
                        </Button>
                      ) : modelsState === "error" ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                size="icon-sm"
                                onClick={loadModels}
                                className="size-10 rounded-full bg-secondary text-secondary-foreground shadow-xs transition-transform hover:bg-secondary/80 active:scale-95 sm:size-8"
                                aria-label="Muat ulang model AI"
                              >
                                <RefreshCw className="size-4.5 sm:size-4" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">Muat ulang model AI</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                type="button"
                                size="icon-sm"
                                onClick={() => {
                                  router.push("/app/settings#ai-models");
                                }}
                                className="size-10 rounded-full bg-primary text-primary-foreground shadow-xs transition-transform hover:bg-primary/90 active:scale-95 sm:size-8"
                                aria-label="Daftarkan API Key di Pengaturan"
                              >
                                <Key className="size-4.5 sm:size-4" aria-hidden="true" />
                              </Button>
                            }
                          />
                          <TooltipContent side="top">
                            Daftarkan API Key di Pengaturan
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
