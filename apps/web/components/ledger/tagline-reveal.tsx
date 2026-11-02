"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TaglineRevealProps {
  text: string;
  className?: string;
}

export function TaglineReveal({ text, className }: TaglineRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordList = useMemo(() => {
    return text.split(" ").map((word, i) => ({ id: `word-${i}-${word}`, text: word }));
  }, [text]);
  const [activeWordCount, setActiveWordCount] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setActiveWordCount(wordList.length);
      return;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight || document.documentElement.clientHeight;

          // Trigger range: starts when top enters 85% of viewport, finishes when top reaches 30% of viewport
          const startTrigger = windowHeight * 0.85;
          const endTrigger = windowHeight * 0.3;
          const totalDistance = startTrigger - endTrigger;

          if (rect.top > startTrigger) {
            setActiveWordCount(0);
          } else if (rect.top <= endTrigger) {
            setActiveWordCount(wordList.length);
          } else {
            const progress = (startTrigger - rect.top) / totalDistance;
            const targetWords = Math.floor(progress * wordList.length);
            setActiveWordCount(Math.min(wordList.length, Math.max(0, targetWords)));
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [wordList.length]);

  return (
    <div ref={containerRef} className={cn("text-balance select-none", className)}>
      {wordList.map((item, index) => {
        const isRevealed = index < activeWordCount;
        return (
          <span key={item.id}>
            <span
              className={cn(
                "inline-block transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                isRevealed
                  ? "translate-y-0 text-foreground opacity-100"
                  : "translate-y-1 text-muted-foreground opacity-30",
              )}
            >
              {item.text}
            </span>{" "}
          </span>
        );
      })}
    </div>
  );
}
