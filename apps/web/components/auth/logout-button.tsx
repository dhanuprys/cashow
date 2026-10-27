"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onLogout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", cache: "no-store" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout} disabled={busy}>
      {busy ? "Keluar…" : "Keluar"}
    </Button>
  );
}
