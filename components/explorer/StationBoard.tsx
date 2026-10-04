"use client";

import { useId, useState, type CSSProperties, type KeyboardEvent } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { lineFor, zoneLabel } from "./lines";
import { Logo } from "@/components/ui/Logo";
import styles from "./StationBoard.module.css";

interface BoardLine {
  topicId: string;
  letter: string;
  name: string;
  color: string;
  firstStation: { id: string; title: string };
}

interface BoardResult {
  id: string;
  title: string;
  titleEs?: string;
  topicId: string | null;
  level: number;
}

interface StationBoardProps {
  lines: BoardLine[];
  activeTopic: string | null;
  onTopic(id: string | null): void;
  query: string;
  onQuery(q: string): void;
  results: BoardResult[];
  searchEmpty: boolean;
  onPick(id: string): void;
  readCount: number;
  total: number;
}

export function StationBoard({
  lines,
  activeTopic,
  onTopic,
  query,
  onQuery,
  results,
  searchEmpty,
  onPick,
  readCount,
  total,
}: StationBoardProps) {
  const uid = useId();
  const listId = `${uid}-results`;
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(true);

  const hasQuery = query.trim().length > 0;
  const showList = hasQuery && open && results.length > 0;
  const showEmpty = hasQuery && open && searchEmpty && results.length === 0;
  const activeIndex = showList && active >= 0 && active < results.length ? active : -1;

  function pick(id: string) {
    onPick(id);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!hasQuery) return;
      setOpen(true);
      if (results.length) setActive((activeIndex + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length) setActive(activeIndex <= 0 ? results.length - 1 : activeIndex - 1);
    } else if (e.key === "Enter") {
      if (showList) {
        e.preventDefault();
        pick(results[activeIndex >= 0 ? activeIndex : 0].id);
      }
    } else if (e.key === "Escape") {
      if (hasQuery) {
        e.preventDefault();
        if (open) setOpen(false);
        else onQuery("");
        setActive(-1);
      }
    }
  }

  const pct = total > 0 ? Math.min(100, (readCount / total) * 100) : 0;

  return (
    <aside className={styles.board} aria-label="Cartelera de estaciones">
      <header className={styles.brand}>
        <div className={styles.mark}>
          <Logo className={styles.markGlyph} size={30} />
          <span className={styles.wordmark}>
            Dager<span className={styles.wordmarkB}>Books</span>
          </span>
        </div>
        <p className={styles.attribution}>
          Las lecturas que recomienda Dager, en un mapa. Proyecto de la comunidad.
        </p>
      </header>

      <h1 className={styles.heading}>¿Dónde arrancás?</h1>

      <div className={styles.search}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Buscar un libro</span>
          <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l5 5" />
          </svg>
          <input
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${uid}-opt-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="¿A qué libro vas?"
            className={styles.input}
            value={query}
            onChange={(e) => {
              onQuery(e.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {hasQuery ? (
            <button
              type="button"
              className={styles.clear}
              aria-label="Borrar la búsqueda"
              onClick={() => {
                onQuery("");
                setActive(-1);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                <path d="M2 2l10 10M12 2L2 12" />
              </svg>
            </button>
          ) : null}
        </label>

        <ul id={listId} role="listbox" aria-label="Estaciones encontradas" className={styles.results} hidden={!showList}>
          {showList
            ? results.map((r, i) => {
                const l = lineFor(r.topicId);
                return (
                  <li
                    key={r.id}
                    id={`${uid}-opt-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    className={styles.option}
                    data-active={i === activeIndex || undefined}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(r.id)}
                    onMouseMove={() => i !== activeIndex && setActive(i)}
                  >
                    <LineDisc letter={l.letter} color={l.color} size="sm" />
                    <span className={styles.optText}>
                      <span className={styles.optTitle}>{r.title}</span>
                      {r.titleEs ? <span className={styles.optSub}>{r.titleEs}</span> : null}
                    </span>
                    <span className={styles.zone}>{zoneLabel(r.level)}</span>
                  </li>
                );
              })
            : null}
        </ul>

        {showEmpty ? (
          <p className={styles.empty} role="status">
            <strong>Esa estación no está en la red.</strong>
            <span>Probá con otro título, el nombre del autor o una palabra suelta.</span>
          </p>
        ) : null}
      </div>

      <div className={styles.trip} role="group" aria-label="Tu progreso">
        <p className={styles.tripCount}>
          Leíste <strong>{readCount}</strong> de <strong>{total}</strong>
        </p>
        <div
          className={styles.tripBar}
          role="progressbar"
          aria-label="Libros leídos"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={readCount}
        >
          <span className={styles.tripFill} style={{ inlineSize: `${pct}%` }} />
        </div>
        <p className={styles.tripNote}>
          {readCount === 0 ? "Tarjeta recién cargada. Picá tu primera estación." : "Se guarda en este navegador, nada más."}
        </p>
      </div>

      <nav className={styles.lines} aria-label="Líneas de la red">
        <ul className={styles.lineList}>
          <li className={styles.lineItem}>
            <button
              type="button"
              className={styles.lineBtn}
              data-reset
              aria-pressed={activeTopic === null}
              onClick={() => onTopic(null)}
            >
              <span className={styles.allMark} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square">
                  <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
                </svg>
              </span>
              <span className={styles.lineText}>
                <span className={styles.lineName}>Toda la red</span>
                <span className={styles.lineHead}>Las diez líneas, sin filtro</span>
              </span>
            </button>
          </li>
          {lines.map((l) => {
            const on = activeTopic === l.topicId;
            return (
              <li key={l.topicId} className={styles.lineItem}>
                <button
                  type="button"
                  className={styles.lineBtn}
                  aria-pressed={on}
                  style={{ "--ink": l.color } as CSSProperties}
                  onClick={() => onTopic(on ? null : l.topicId)}
                >
                  <LineDisc letter={l.letter} color={l.color} />
                  <span className={styles.lineText}>
                    <span className={styles.lineName}>{l.name}</span>
                    <span className={styles.lineHead}>Cabecera: {l.firstStation.title}</span>
                  </span>
                  <span className={styles.track} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
