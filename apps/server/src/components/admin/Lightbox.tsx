"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { IconButton } from "./ui";
import { springSoft } from "./motion";

export interface LightboxImage {
  src: string;
  title: string;
  caption?: string;
}

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

  return (
    <AnimatePresence>
      {open && current ? (
        <motion.div key="lightbox" className="fixed inset-0 z-[95] flex flex-col bg-ink-950/95 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <header className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-semibold text-ink-50">{current.title}</p>
              {current.caption ? <p className="truncate text-[12.5px] text-ink-400">{current.caption}</p> : null}
            </div>
            <div className="flex items-center gap-1">
              <IconButton label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                <ZoomOut size={18} />
              </IconButton>
              <span className="w-12 text-center text-[12.5px] font-semibold text-ink-300">{Math.round(zoom * 100)}%</span>
              <IconButton label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4}>
                <ZoomIn size={18} />
              </IconButton>
              <IconButton label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw size={18} />
              </IconButton>
              <a href={current.src} download target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-xl text-ink-300 hover:bg-white/6 hover:text-ink-50" aria-label="Open original" title="Open original">
                <Download size={18} />
              </a>
              <IconButton label="Close" onClick={onClose}>
                <X size={20} />
              </IconButton>
            </div>
          </header>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-14" onClick={onClose}>
            {images.length > 1 ? (
              <>
                <button type="button" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="Previous image" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink-800/80 text-ink-100 hover:bg-ink-700">
                  <ChevronLeft size={22} />
                </button>
                <button type="button" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="Next image" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink-800/80 text-ink-100 hover:bg-ink-700">
                  <ChevronRight size={22} />
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
                className="max-h-full max-w-full cursor-zoom-in select-none rounded-xl object-contain shadow-float"
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
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${i === index ? "border-brand-400" : "border-transparent opacity-60 hover:opacity-100"}`}
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
