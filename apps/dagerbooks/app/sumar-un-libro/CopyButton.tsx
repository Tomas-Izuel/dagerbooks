"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";

/** Copia el texto al portapapeles; si el navegador lo bloquea, avisa y deja el bloque para seleccionar. */
export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  }

  return (
    <>
      <button type="button" className={styles.copy} data-state={state} onClick={copy}>
        {state === "done" ? "Copiado" : state === "failed" ? "No se pudo" : "Copiar"}
      </button>
      <span className={styles.srOnly} role="status">
        {state === "done" ? "Plantilla copiada al portapapeles" : state === "failed" ? "No se pudo copiar; seleccioná el texto a mano" : ""}
      </span>
    </>
  );
}
