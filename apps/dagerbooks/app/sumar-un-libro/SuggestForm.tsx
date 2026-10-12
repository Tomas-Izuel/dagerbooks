"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SUGGESTION_LIMITS, type SuggestionFieldError } from "@estantes/kit";
import { suggestBook, type SuggestState } from "./actions";
import styles from "./page.module.css";

const FIELD_ERRORS: Record<SuggestionFieldError, string> = {
  required: "Falta el título del libro.",
  "too-long": "Es demasiado largo.",
  "invalid-url": "No parece un link. Copialo entero, con https://.",
  "unknown-platform": "Tiene que ser un link de un video, short o stream de Dager.",
  "invalid-minute": "Escribilo como 12:34 o 1:02:03.",
};

const MESSAGES: Partial<Record<SuggestState["status"], string>> = {
  limited: "Mandaste varias seguidas. Esperá unos minutos y probá de nuevo.",
  blocked: "No pudimos verificar que seas una persona. Recargá la página y probá de nuevo.",
  unavailable: "Ahora no podemos recibir sugerencias desde acá. Probá más tarde.",
  error: "Algo falló al guardarla. Probá de nuevo en un rato.",
};

export function SuggestForm() {
  const [state, action, pending] = useActionState<SuggestState, FormData>(suggestBook, { status: "idle" });
  const errors = state.status === "invalid" ? state.errors : {};
  const fieldError = (name: keyof typeof errors) =>
    errors[name] ? (
      <p id={`${name}-error`} className={styles.fieldError}>
        {FIELD_ERRORS[errors[name]!]}
      </p>
    ) : null;
  const describedBy = (name: keyof typeof errors, hint?: string) =>
    [hint, errors[name] ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;

  if (state.status === "created") {
    return (
      <div className={styles.result} role="status">
        <p className={styles.resultTitle}>¡Listo, la recibimos!</p>
        <p>Vamos a buscar dónde lo recomienda Dager. Si entra, lo vas a ver en las novedades del mapa.</p>
      </div>
    );
  }

  return (
    <form action={action} className={styles.form} noValidate>
      <div className={styles.field}>
        <label htmlFor="title" className={styles.label}>
          Título del libro
        </label>
        <input
          id="title"
          name="title"
          className={styles.input}
          required
          maxLength={SUGGESTION_LIMITS.title}
          autoComplete="off"
          aria-invalid={!!errors.title}
          aria-describedby={describedBy("title")}
        />
        {fieldError("title")}
      </div>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label htmlFor="link" className={styles.label}>
            Link al video o stream <span className={styles.optional}>si lo tenés</span>
          </label>
          <input
            id="link"
            name="link"
            type="url"
            inputMode="url"
            className={styles.input}
            maxLength={SUGGESTION_LIMITS.link}
            placeholder="https://www.youtube.com/watch?v=…"
            aria-invalid={!!errors.link}
            aria-describedby={describedBy("link")}
          />
          {fieldError("link")}
        </div>
        <div className={styles.field} data-size="sm">
          <label htmlFor="minute" className={styles.label}>
            Minuto <span className={styles.optional}>opcional</span>
          </label>
          <input
            id="minute"
            name="minute"
            className={styles.input}
            maxLength={SUGGESTION_LIMITS.minute}
            placeholder="12:34"
            inputMode="numeric"
            aria-invalid={!!errors.minute}
            aria-describedby={describedBy("minute")}
          />
          {fieldError("minute")}
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="comment" className={styles.label}>
          Algo más <span className={styles.optional}>opcional</span>
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          className={styles.input}
          maxLength={SUGGESTION_LIMITS.comment}
          placeholder="Qué dice del libro, o por qué te parece que va en el mapa."
          aria-invalid={!!errors.comment}
          aria-describedby={describedBy("comment")}
        />
        {fieldError("comment")}
      </div>

      <div className={styles.submitRow}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? "Enviando…" : "Mandar sugerencia"}
        </button>
        <p className={styles.privacy}>No pedimos mail ni nombre: la sugerencia se guarda sin datos tuyos.</p>
      </div>

      <div aria-live="polite" className={styles.live}>
        {state.status === "exists" ? (
          <p className={styles.notice}>
            Ese ya está en el mapa: <Link href={`/libros/${state.book.id}`}>{state.book.title}</Link>.
          </p>
        ) : MESSAGES[state.status] ? (
          <p className={styles.notice} data-tone="error">
            {MESSAGES[state.status]}
          </p>
        ) : null}
      </div>
    </form>
  );
}
