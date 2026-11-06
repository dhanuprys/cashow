import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}

/**
 * Padded page frame. The AI chat page opts out of the frame through a
 * `data-chat-page` marker on its root, so this stays a server component: no
 * `usePathname()` means no client hook blocking prerender. On mobile the chat
 * is edge-to-edge; from `sm` up the normal gutters return.
 */
export function AppMain({ children }: AppShellProps) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-hidden px-4 pt-4 pb-32 sm:px-6 sm:pt-6 md:pb-8 has-[[data-chat-page]]:max-w-none has-[[data-chat-page]]:px-0 has-[[data-chat-page]]:pt-0 has-[[data-chat-page]]:pb-0 sm:has-[[data-chat-page]]:max-w-5xl sm:has-[[data-chat-page]]:px-6">
      {children}
    </main>
  );
}
