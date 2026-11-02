import type { ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return <div className="flex min-h-dvh flex-col">{children}</div>;
}

export function AppMain({ children }: AppShellProps) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-hidden px-4 pt-4 pb-32 sm:px-6 sm:pt-6 md:pb-8 has-[[data-chat-page]]:pt-0 sm:has-[[data-chat-page]]:pt-0 has-[[data-chat-page]]:pb-0 md:has-[[data-chat-page]]:pb-0">
      {children}
    </main>
  );
}
