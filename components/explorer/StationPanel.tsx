"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { LineDisc } from "@/components/ui/LineDisc";
import { RecMark } from "@/components/ui/RecMark";
import type { Recommendation } from "@/lib/catalog/schema";
import { Dotted } from "@/components/page/Dotted";
import { AmazonBuy } from "@/components/page/AmazonBuy";
import { lineFor, zoneLabel } from "./lines";
import type { PanelBook, StationRef } from "./types";
import styles from "./StationPanel.module.css";

interface StationPanelProps {
  book: PanelBook | null;
  line: { letter: string; color: string; name: string } | null;
  prerequisites: StationRef[];
  unlocks: StationRef[];
  related: (StationRef & { reason: string })[];
  isRead: boolean;
  onToggleRead(): void;
  onClose(): void;
  onSelect(id: string): void;
  readHydrated: boolean;
  recLabels: Record<Recommendation, { label: string; description: string }>;
}

const MISSING_LABELS: Record<string, string> = {
  authors: "autores",
  summary: "resumen",
  context: "por qué lo recomienda Dager",
  sources: "fuentes",
};

const KIND_LABELS: Record<string, string> = {
  book: "Libro",
  essay: "Ensayo",
  course: "Curso",
  textbook: "Texto de estudio",
  paper: "Paper",
};

function sourceLabel(s: PanelBook["sources"][number]): string {
  if (s.title) return s.title;
  try {
    return new URL(s.url).hostname.replace(/^www\./, "");
  } catch {
    return s.url;
  }
}

function isYouTube(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h.endsWith("youtube.com") || h === "youtu.be";
  } catch {
    return false;
  }
}

export function StationPanel(props: StationPanelProps) {
  if (!props.book) return null;
  return <PanelInner {...props} book={props.book} />;
}

function StationList({
  items,
  onSelect,
}: {
  items: (StationRef & { reason?: string })[];
  onSelect(id: string): void;
}) {
  return (
    <ul className={styles.stops}>
      {items.map((r) => {
        const l = lineFor(r.topicId);
        return (
          <li key={r.id}>
            <button type="button" className={styles.stop} onClick={() => onSelect(r.id)}>
              <LineDisc letter={l.letter} color={l.color} size="sm" />
              <span className={styles.stopText}>
                <span className={styles.stopTitle}>{r.title}</span>
                {r.reason ? <span className={styles.stopReason}>{r.reason}</span> : null}
              </span>
              <span className={styles.stopZone}>{r.level === 0 ? "Km 0" : `Z${r.level}`}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function PanelInner({
  book,
  line,
  prerequisites,
  unlocks,
  related,
  isRead,
  onToggleRead,
  onClose,
  onSelect,
  readHydrated,
  recLabels,
}: StationPanelProps & { book: PanelBook }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Remember who had focus when the panel opened; give it back on close.
  useEffect(() => {
    returnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const el = returnRef.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
    };
  }, []);

  // Move focus to the heading each time a different station opens.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [book.id]);

  // Not a modal: Escape closes from anywhere unless another widget already used it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("input, [role='combobox']")) return;
      closeRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ink = line?.color ?? "var(--porcelain-50)";
  const letter = line?.letter ?? "0";
  const meta = [book.authors.join(", "), book.year ? String(book.year) : null, KIND_LABELS[book.kind] ?? book.kind];
  const missing = book.missing.map((m) => MISSING_LABELS[m] ?? m);

  return (
    <aside
      className={styles.panel}
      aria-label={`Estación ${book.title}`}
      style={{ "--ink": ink } as CSSProperties}
    >
      <header className={styles.sign}>
        <span className={styles.grab} aria-hidden="true" />
        <div className={styles.signTop}>
          <LineDisc
            letter={letter}
            color={ink}
            size="lg"
            label={line ? `Línea ${line.letter}, ${line.name}` : "Kilómetro 0"}
          />
          <div className={styles.signMeta}>
            <span className={styles.zone}>{zoneLabel(book.level)}</span>
            {line ? <span className={styles.lineName}>{line.name}</span> : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar la estación">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1} className={styles.title}>
          {book.title}
        </h2>
        {book.titleEs ? <p className={styles.titleEs}>{book.titleEs}</p> : null}
        <p className={styles.byline}>
          <Dotted parts={meta} />
        </p>
        {book.level > 0 ? (
          <p className={styles.rec} title={recLabels[book.recommendation].description}>
            <RecMark level={book.recommendation} size={20} />
            <span className={styles.recKey}>Dager</span>
            <span>{recLabels[book.recommendation].label}</span>
          </p>
        ) : null}
      </header>

      <div className={styles.body}>
        {book.coverId ? (
          <figure className={styles.plaque}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`}
              width={72}
              height={108}
              alt={`Tapa de ${book.title}`}
              loading="lazy"
            />
          </figure>
        ) : null}

        {book.context ? (
          <p className={styles.lead}>{book.context}</p>
        ) : null}
        {book.summary ? <p className={styles.summary}>{book.summary}</p> : null}

        <button
          type="button"
          className={styles.punch}
          aria-pressed={isRead}
          disabled={!readHydrated}
          onClick={onToggleRead}
        >
          <svg className={styles.ticket} width="30" height="22" viewBox="0 0 30 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M2 2h26v6a3 3 0 0 0 0 6v6H2v-6a3 3 0 0 0 0-6z" />
            <circle cx="15" cy="11" r="3.5" fill={isRead ? "var(--bg-sunken)" : "none"} />
          </svg>
          <span className={styles.punchText}>
            <span className={styles.punchLabel}>Lo leí</span>
            <span className={styles.punchState}>
              {!readHydrated ? "Buscando tu tarjeta…" : isRead ? "Picado. Ya pasaste por acá." : "Sin picar. Tocá cuando lo termines."}
            </span>
          </span>
        </button>

        {book.sources.length > 0 ? (
          <section className={styles.section} aria-labelledby="sp-sources">
            <h3 id="sp-sources" className={styles.sectionTitle}>
              Dónde lo dice
            </h3>
            <ul className={styles.sources}>
              {book.sources.map((s, i) => (
                <li key={`${s.url}-${i}`} className={styles.source}>
                  <a className={styles.sourceLink} href={s.url} target="_blank" rel="noopener noreferrer">
                    {isYouTube(s.url) ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                        <path d="M3 1.5v11l9-5.5z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                        <path d="M5 2H2v10h10V9M8 2h4v4M12 2L6 8" />
                      </svg>
                    )}
                    <span>{sourceLabel(s)}</span>
                    {s.timestamp ? <span className={styles.stamp}>{s.timestamp}</span> : null}
                    <span className={styles.srOnly}>(se abre en otra pestaña)</span>
                  </a>
                  {s.quote ? <blockquote className={styles.quote}>{s.quote}</blockquote> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {prerequisites.length > 0 || unlocks.length > 0 ? (
          <section className={styles.section} aria-labelledby="sp-route">
            <h3 id="sp-route" className={styles.sectionTitle}>
              Recorrido
            </h3>
            {prerequisites.length > 0 ? (
              <div className={styles.group}>
                <h4 className={styles.groupTitle}>Antes pasás por</h4>
                <StationList items={prerequisites} onSelect={onSelect} />
              </div>
            ) : null}
            {unlocks.length > 0 ? (
              <div className={styles.group}>
                <h4 className={styles.groupTitle}>Después seguís a</h4>
                <StationList items={unlocks} onSelect={onSelect} />
              </div>
            ) : null}
          </section>
        ) : null}

        {related.length > 0 ? (
          <section className={styles.section} aria-labelledby="sp-related">
            <h3 id="sp-related" className={styles.sectionTitle}>
              Combinaciones
            </h3>
            <StationList items={related} onSelect={onSelect} />
          </section>
        ) : null}

        {book.confidence === "low" ? (
          <div className={styles.todo} role="note">
            <h3 className={styles.todoTitle}>Por completar</h3>
            <p>
              Esta estación todavía está en obra.
              {missing.length > 0 ? ` Falta: ${missing.join(", ")}.` : ""} Si sabés algo, sumalo con un PR.
            </p>
          </div>
        ) : null}

        {book.asin ? <AmazonBuy asin={book.asin} title={book.title} /> : null}

        <Link className={styles.full} href={`/libros/${book.id}`}>
          Ficha completa
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
            <path d="M1 7h15M10 1l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </aside>
  );
}
