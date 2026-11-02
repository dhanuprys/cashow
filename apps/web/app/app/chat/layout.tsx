export const metadata = {
  title: "Tanya AI",
};

/**
 * The chat page is a client component (it owns the input and the transcript),
 * so the route-level metadata lives in this pass-through layout.
 */
export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-6rem)] min-h-0 flex-1 flex-col overflow-hidden sm:h-[calc(100dvh-6.5rem)] md:h-[calc(100dvh-7rem)]">
      {children}
    </div>
  );
}
