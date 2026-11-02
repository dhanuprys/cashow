export const metadata = {
  title: "Impor CSV",
};

/**
 * The import page is a client component (it drives `useActionState`), so the
 * route-level metadata lives in this pass-through layout.
 */
export default function ImportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
