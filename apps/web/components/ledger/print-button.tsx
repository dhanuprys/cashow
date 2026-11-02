"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Triggers the browser print dialog for the current dashboard view. */
export function PrintButton() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
      className="min-h-9 print:hidden"
    >
      <Printer aria-hidden="true" />
      Cetak laporan
    </Button>
  );
}
