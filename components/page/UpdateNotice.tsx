"use client";

import Link from "next/link";
import { useSeenUpdate } from "@/hooks/useSeenUpdate";
import styles from "./UpdateNotice.module.css";

export interface UpdateNoticeData {
  id: string;
  /** YYYY-MM-DD. */
  isoDate: string;
  /** Fecha ya formateada ("11 oct 2026"). */
  date: string;
  title: string;
  bookCount: number;
  streamTitle?: string;
  improvementCount: number;
}

/** Aviso de servicio: la última actualización, cerrable. Aparece solo en cliente si todavía no se vio. */
export function UpdateNotice({ update }: { update: UpdateNoticeData }) {
  const { seen, markSeen } = useSeenUpdate(update.id);
  if (seen) return null;

  const summary = update.bookCount
    ? `${update.bookCount} ${update.bookCount === 1 ? "libro nuevo" : "libros nuevos"}${update.streamTitle ? " del stream" : ""}`
    : `${update.improvementCount} ${update.improvementCount === 1 ? "mejora" : "mejoras"}`;

  return (
    <aside className={styles.notice} aria-labelledby="aviso-titulo">
      <div className={styles.body}>
        <p className={styles.meta}>
          <span className={styles.tag}>Aviso</span>
          <time dateTime={update.isoDate}>{update.date}</time>
        </p>
        <p id="aviso-titulo" className={styles.title}>
          {update.title}
        </p>
        <p className={styles.summary}>
          {summary}
          {update.bookCount && update.streamTitle ? <span className={styles.stream}>«{update.streamTitle}»</span> : null}
        </p>
        <Link href="/novedades" className={styles.more} onClick={markSeen}>
          Ver novedades <span aria-hidden="true">→</span>
        </Link>
      </div>
      <button type="button" className={styles.close} onClick={markSeen} aria-label="Cerrar el aviso de novedades">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" fill="none" />
        </svg>
      </button>
    </aside>
  );
}
