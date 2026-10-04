"use client";

import { useEffect } from "react";
import { useDensity } from "@/hooks/useDensity";

/**
 * Páginas estáticas (libro, tema, estaciones): copia la preferencia de densidad a <html data-density>
 * tras montar. El servidor renderiza compacta; no hay cambio de markup, solo de tokens CSS.
 */
export function DensityAttr() {
  const { density, hydrated } = useDensity();
  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.dataset.density = density;
    return () => {
      delete root.dataset.density;
    };
  }, [density, hydrated]);
  return null;
}
