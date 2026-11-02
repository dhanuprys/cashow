"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import type React from "react";
import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CodeBlockRenderer({ className, children, ...props }: React.ComponentProps<"code">) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const isInline = !match && typeof children === "string" && !children.includes("\n");

  if (isInline) {
    return (
      <code
        className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground break-all"
        {...props}
      >
        {children}
      </code>
    );
  }

  const rawCode = String(children).replace(/\n$/, "");
  const language = match ? match[1] : "";

  function copyCode() {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-2xl border border-border bg-muted/50 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/80 px-3 py-1.5 text-xs text-muted-foreground">
        <span>{language || "code"}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={copyCode}
          aria-label="Salin kode"
          className="size-6 text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
      <div className="overflow-x-auto p-3 text-foreground">
        <code className={className} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
}

export const ChatMarkdown = memo(function ChatMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none break-words text-foreground leading-relaxed",
        // Typography tweaks to match shadcn aesthetics
        "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
        "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:my-2",
        "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:my-2",
        "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1.5",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2",
        "[&_table]:my-2 [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse",
        "[&_th]:border-b [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border-b [&_td]:border-border/60 [&_td]:p-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: CodeBlockRenderer,
          table: ({ children, ...props }) => (
            <div className="my-3 w-full overflow-x-auto rounded-lg border border-border/70 bg-card/30">
              <table className="w-full text-xs border-collapse" {...props}>
                {children}
              </table>
            </div>
          ),
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline underline-offset-4 hover:opacity-80"
              {...props}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
