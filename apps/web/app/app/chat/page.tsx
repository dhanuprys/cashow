"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (message.trim() === "") return;
    setLoading(true);
    setAnswer("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      setAnswer(data.answer ?? data.error ?? "Tidak ada jawaban.");
    } catch {
      setAnswer("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">AI</p>
        <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Chat keuangan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tanya tentang saldo, pengeluaran, dan anggaran Anda.
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Pertanyaan</CardTitle>
          <CardDescription>AI menggunakan konteks keuangan Anda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Contoh: berapa pengeluaran bulan ini?"
              onKeyDown={(event) => {
                if (event.key === "Enter") send();
              }}
            />
            <Button type="button" onClick={send} disabled={loading}>
              <Send aria-hidden="true" />
              {loading ? "…" : "Kirim"}
            </Button>
          </div>
          {answer !== "" ? (
            <div className="rounded-2xl bg-muted/40 p-4 text-sm whitespace-pre-wrap">{answer}</div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
