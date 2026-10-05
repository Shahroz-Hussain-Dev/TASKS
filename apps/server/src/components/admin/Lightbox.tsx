"use client";

import { ArrowClockwise, CaretLeft, CaretRight, DownloadSimple, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { springSoft } from "./motion";

export interface LightboxImage {
  src: string;
  title: string;
  caption?: string;
}

/** Full-screen viewer. Deliberately keeps a dark overlay so photos read true; chrome is light-on-dark here only. */
export function Lightbox({ images, index, onClose, onIndexChange }: { images: LightboxImage[]; index: number | null; onClose: () => void; onIndexChange: (i: number) => void }) {
  const open = index !== null && images[index] !== undefined;
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [index]);

  const go = useCallback(
    (delta: number) => {
      if (index === null || images.length === 0) return;
      onIndexChange((index + delta + images.length) % images.length);
    },
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(4, z + 0.5));
      else if (e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  const current = index !== null ? images[index] : undefined;
  const chrome = "grid h-10 w-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/15 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <AnimatePresence>
      {open && current ? (
        <motion.div key="lightbox" className="fixed inset-0 z-[95] flex flex-col bg-ink-950/92 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold text-white">{current.title}</p>
              {current.caption ? <p className="truncate text-[12.5px] text-white/70">{current.caption}</p> : null}
            </div>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Zoom out" title="Zoom out" className={chrome} onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                <MagnifyingGlassMinus size={20} weight="duotone" />
              </button>
              <span className="w-12 text-center text-[12.5px] font-bold tabular-nums text-white/85">{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label="Zoom in" title="Zoom in" className={chrome} onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4}>
                <MagnifyingGlassPlus size={20} weight="duotone" />
              </button>
              <button type="button" aria-label="Rotate" title="Rotate" className={chrome} onClick={() => setRotation((r) => (r + 90) % 360)}>
                <ArrowClockwise size={20} weight="duotone" />
              </button>
              <a href={current.src} download target="_blank" rel="noreferrer" className={chrome} aria-label="Open original" title="Open original">
                <DownloadSimple size={20} weight="duotone" />
              </a>
              <button type="button" aria-label="Close" title="Close" className={chrome} onClick={onClose}>
                <X size={22} weight="bold" />
              </button>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-14" onClick={onClose}>
            {images.length > 1 ? (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous image" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-900 shadow-float hover:bg-paper-100">
                  <CaretLeft size={22} weight="bold" />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next image" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-ink-900 shadow-float hover:bg-paper-100">
                  <CaretRight size={22} weight="bold" />
                </button>
              </>
            ) : null}
            <AnimatePresence mode="wait">
              <motion.img
                key={current.src}
                src={current.src}
                alt={current.title}
                onClick={(e) => { e.stopPropagation(); setZoom((z) => (z >= 2 ? 1 : 2)); }}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: zoom, rotate: rotation }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                transition={springSoft}
                drag={zoom > 1}
                dragMomentum={false}
                className="max-h-full max-w-full cursor-zoom-in select-none rounded-2xl object-contain shadow-float ring-4 ring-white"
                style={{ cursor: zoom > 1 ? "grab" : "zoom-in" }}
              />
            </AnimatePresence>
          </div>

          {images.length > 1 ? (
            <footer className="no-scrollbar flex justify-center gap-2 overflow-x-auto px-4 py-3">
              {images.map((img, i) => (
                <button
                  key={img.src}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-[3px] transition ${i === index ? "border-coral-500" : "border-transparent opacity-60 hover:opacity-100"}`}
                  aria-label={img.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </footer>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
