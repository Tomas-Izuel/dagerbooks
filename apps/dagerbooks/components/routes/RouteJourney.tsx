"use client";

import { Dotted } from "@/components/page/Dotted";
import Link from "next/link";
import { useMemo } from "react";
import { LineDisc } from "@/components/ui/LineDisc";
import { WalkSign } from "@/components/page/WalkSign";
import { ArrowLink } from "@/components/page/ArrowLink";
import { useReadProgress } from "@/hooks/useReadProgress";
import { detoursLabel, routeProgress } from "@/lib/routes/progress";
import type { JourneyStop } from "@/lib/routes/journey";
import styles from "./RouteJourney.module.css";

interface RouteJourneyProps {
  routeId: string;
  routeName: string;
  stops: JourneyStop[];
}

function Ticket({ punched }: { punched: boolean }) {
  return (
    <svg className={styles.ticket} width="28" height="20" viewBox="0 0 30 22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 2h26v6a3 3 0 0 0 0 6v6H2v-6a3 3 0 0 0 0-6z" />
      <circle cx="15" cy="11" r="3.5" fill={punched ? "currentColor" : "none"} />
    </svg>
  );
}

const stateOf = (read: boolean, isNext: boolean) => (read ? "read" : isNext ? "next" : "todo");

/**
 * El itinerario: riel de progreso (lateral en escritorio, barra fina arriba en celular) y la vía
 * vertical con sus paradas. Todo el progreso sale de `useReadProgress`, el mismo "Lo leí" del mapa,
 * así que un libro marcado en otro lado cuenta acá. Antes de montar se muestra "sin empezar".
 */
export function RouteJourney({ routeId, routeName, stops }: RouteJourneyProps) {
  const progress = useReadProgress();
  const refs = useMemo(() => stops.map((s) => ({ id: s.id, title: s.title, optional: s.optional })), [stops]);
  const p = routeProgress(refs, progress.read);
  const next = p.next >= 0 ? stops[p.next] : null;
  const optionalLeft = p.detoursTotal - p.detoursDone;
  const detours = detoursLabel(p);
  // La última parada que no es un desvío es la terminal; los desvíos que vengan después son un ramal aparte.
  const terminal = stops.reduce((acc, s, i) => (s.optional ? acc : i), 0);
  const mainStops = stops.filter((s) => !s.optional);
  const status = p.complete ? "done" : p.started ? "mid" : "new";

  return (
    <div className={styles.layout} data-status={status}>
      <aside className={styles.rail} aria-label="Tu avance en la ruta">
        <div className={styles.barRow}>
          <p className={styles.count}>
            <strong>{p.done}</strong> de {p.total}
            <span className={styles.srOnly}> leídos</span>
          </p>
          <div className={styles.segments} role="progressbar" aria-label={`Avance en ${routeName}`} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
            {mainStops.map((s) => (
              <span key={s.id} className={styles.segment} data-state={stateOf(progress.read.has(s.id), s === next)} />
            ))}
          </div>
          <p className={styles.where}>
            {status === "done" ? (
              <>Llegaste. Fin de línea{detours ? ` · ${detours}` : ""}</>
            ) : next ? (
              <a href={`#parada-${next.n}`} className={styles.whereLink}>
                {status === "new" ? "Arrancás en" : "Próxima"}: {next.title}
              </a>
            ) : null}
          </p>
        </div>

        <div className={styles.railBody}>
          <h2 className={styles.railCount}>
            <strong>{p.done}</strong> de {p.total} <span className={styles.railWord}>leídos</span>
          </h2>
          <p className={styles.railSub}>
            {status === "done" ? "Vía principal completa." : p.done === 0 ? `Sin empezar. Faltan ${p.remaining}.` : `Faltan ${p.remaining}.`}
            {detours ? <span className={styles.railDetours}> {detours[0].toUpperCase() + detours.slice(1)}</span> : null}
          </p>
          <ol className={styles.mini}>
            {stops.map((s) => {
              const st = stateOf(progress.read.has(s.id), s === next);
              return (
                <li key={s.id} className={styles.miniItem} data-state={st} data-optional={s.optional || undefined}>
                  <a href={`#parada-${s.n}`} className={styles.miniLink} aria-current={st === "next" ? "step" : undefined}>
                    <span className={styles.miniDot} aria-hidden="true" />
                    <span className={styles.miniTitle}>{s.title}</span>
                    <span className={styles.srOnly}>
                      {st === "read" ? ". Leído" : st === "next" ? ". Próxima parada" : ""}
                      {s.optional ? ". Optativo" : ""}
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
          {status === "done" ? (
            <p className={styles.railDone}>Llegaste. Fin de línea, bajan todos.</p>
          ) : next ? (
            <a href={`#parada-${next.n}`} className={styles.railNext}>
              {status === "new" ? "Ir a la primera parada" : "Ir a la próxima parada"}
            </a>
          ) : null}
          {!progress.persisted && progress.hydrated ? (
            <p className={styles.railNote}>Este navegador no guarda datos: lo marcado dura hasta recargar.</p>
          ) : null}
        </div>
      </aside>

      <div className={styles.main}>
        <ol className={styles.track} aria-label={`Paradas de ${routeName}, en orden de lectura`}>
          {stops.map((s, i) => {
            const read = progress.read.has(s.id);
            const st = stateOf(read, s === next);
            const prev = stops[i - 1];
            const kind = s.optional ? (i > terminal ? "tail" : "detour") : i === terminal ? "terminal" : "main";
            const tailFollows = kind === "terminal" && terminal < stops.length - 1;
            const lastOfAll = i === stops.length - 1;
            return (
              <li
                key={s.id}
                id={`parada-${s.n}`}
                className={styles.stop}
                data-state={st}
                data-kind={kind}
                data-tail-follows={tailFollows || undefined}
                data-last={lastOfAll || undefined}
              >
                {s.gap && prev ? (
                  <div className={styles.walk}>
                    <span className={styles.walkCut} aria-hidden="true" />
                    <span className={styles.walkSteps} aria-hidden="true" />
                    <div className={styles.walkSign}>
                      <WalkSign gap={s.gap} direction="in" between={`Entre «${prev.title}» y «${s.title}»`} />
                    </div>
                  </div>
                ) : null}

                <section className={styles.body} aria-labelledby={`parada-${s.n}-titulo`}>
                  {kind === "detour" || kind === "tail" || tailFollows ? <span className={styles.siding} aria-hidden="true" /> : null}
                  <span className={styles.station} aria-hidden="true">
                    <span className={styles.number}>{s.n}</span>
                    {s.line ? (
                      <span className={styles.transfer}>
                        <LineDisc letter={s.line.letter} color={s.line.color} size="sm" />
                      </span>
                    ) : null}
                  </span>

                  <div className={styles.content}>
                    <h2 id={`parada-${s.n}-titulo`} className={styles.title}>
                      <span className={styles.srOnly}>Parada {s.n}: </span>
                      <Link href={s.href}>{s.title}</Link>
                    </h2>
                    {s.titleEs ? <p className={styles.titleEs}>{s.titleEs}</p> : null}

                    <p className={styles.facts}>
                      {st === "next" ? <span className={styles.tag} data-tone="next">Próxima</span> : null}
                      {st === "read" ? <span className={styles.tag} data-tone="read">Leído</span> : null}
                      {s.optional ? <span className={styles.tag} data-tone="detour">Desvío optativo</span> : null}
                      {kind === "terminal" ? <span className={styles.tag} data-tone="end">Fin de línea</span> : null}
                      {s.line ? (
                        <span className={styles.fact}>
                          <LineDisc letter={s.line.letter} color={s.line.color} size="sm" />
                          {s.transfer ? <>Transbordo a la línea {s.line.letter}, {s.line.name}</> : <>Línea {s.line.letter}, {s.line.name}</>}
                        </span>
                      ) : null}
                      <span className={styles.fact}>
                        <Dotted parts={[`Zona ${s.level}`, s.levelLabel]} />
                      </span>
                    </p>

                    {s.optional ? <p className={styles.detourNote}>Podés saltearla: la ruta sigue por la vía principal.</p> : null}

                    <div className={styles.why}>
                      <h3 className={styles.label}>Por qué acá</h3>
                      <p>{s.why}</p>
                    </div>

                    {s.quote ? (
                      <figure className={styles.quote}>
                        {s.quote.quote ? <blockquote>{s.quote.quote}</blockquote> : null}
                        <figcaption>
                          <Dotted parts={["Dager", s.quote.where]} />
                          <span aria-hidden="true"> — </span>
                          <a href={s.quote.url} target="_blank" rel="noopener noreferrer">
                            {s.quote.linkLabel}
                          </a>
                        </figcaption>
                      </figure>
                    ) : null}

                    {s.order ? (
                      <div className={styles.order}>
                        <h3 className={styles.label}>Orden que marcó Dager</h3>
                        <p>
                          «{s.order.quote}»{" "}
                          <a href={s.order.url} target="_blank" rel="noopener noreferrer">
                            {s.order.linkLabel}
                          </a>
                        </p>
                      </div>
                    ) : null}

                    <div className={styles.actions}>
                      <button
                        type="button"
                        className={styles.punch}
                        aria-pressed={read}
                        disabled={!progress.hydrated}
                        onClick={() => progress.toggle(s.id)}
                      >
                        <Ticket punched={read} />
                        <span className={styles.punchText}>
                          <span className={styles.punchLabel}>Lo leí</span>
                          <span className={styles.punchState}>
                            {!progress.hydrated ? "Buscando tu tarjeta…" : read ? "Picado" : "Sin picar"}
                          </span>
                        </span>
                      </button>
                      <Link href={s.href} className={styles.fichaLink}>
                        Ver la ficha
                        <span className={styles.srOnly}> de {s.title}</span>
                      </Link>
                    </div>
                  </div>
                </section>
              </li>
            );
          })}
        </ol>

        <section className={styles.terminal} data-done={p.complete || undefined} aria-live="polite">
          {p.complete ? (
            <>
              <h2 className={styles.terminalTitle}>Llegaste</h2>
              <p>Fin de línea, bajan todos. {optionalLeft > 0 ? `Te quedó ${optionalLeft === 1 ? "un desvío" : `${optionalLeft} desvíos`} por si querés pasear.` : "Hiciste la ruta completa."}</p>
            </>
          ) : (
            <>
              <h2 className={styles.terminalTitle}>Fin de línea</h2>
              <p>
                {p.started ? `Te ${p.remaining === 1 ? "falta 1 parada" : `faltan ${p.remaining} paradas`}.` : `Son ${p.total} paradas.`} Cada libro que marques con «Lo leí» se cuenta acá y en el mapa.
              </p>
            </>
          )}
          <div className={styles.terminalLinks}>
            <ArrowLink href={`/?ruta=${routeId}`} variant="ghost">
              Ver en el mapa
            </ArrowLink>
            <ArrowLink href="/rutas" variant="ghost">
              Otras rutas
            </ArrowLink>
          </div>
        </section>
      </div>
    </div>
  );
}
