import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLink } from "@/components/page/ArrowLink";
import { CONTRIBUTE_URL } from "@/components/page/constants";
import { PageShell } from "@/components/page/PageShell";
import { LineDisc } from "@/components/ui/LineDisc";
import { allLines } from "@/components/page/lines";
import { CopyButton } from "./CopyButton";
import styles from "./page.module.css";

const BOOKS_YAML = CONTRIBUTE_URL ?? "https://github.com/Tomas-Izuel/dagerbooks/blob/main/content/books.yaml";

export const metadata: Metadata = {
  title: "Sumá un libro a la red",
  description:
    "Cómo proponer un libro que recomendó Dager: editás books.yaml en GitHub, abrís un Pull Request y, tras la revisión, aparece en el mapa.",
  alternates: { canonical: "/sumar-un-libro" },
};

const TEMPLATE = `- id: mi-libro                 # obligatorio: slug en kebab-case, único
  title: "Título original"     # obligatorio: en el idioma del libro
  topics: [fundamentos]        # obligatorio: el primero es la línea donde se dibuja
  level: 1                     # obligatorio: 1 introductorio ... 4 especialista
  # --- opcionales: lo que no sepas, dejalo afuera ---
  titleEs: "Título en español"
  authors: ["Nombre Apellido"]
  year: 2015
  kind: book                   # book | essay | paper | course | textbook
  summary: "De qué trata, en una o dos frases."
  context: "Qué dice Dager y por qué lo recomienda."
  sources:
    - url: "https://www.youtube.com/watch?v=XXXXXXXXXXX&t=419s"
      title: "Título del video"
      timestamp: "6:59"
      quote: "lo que dice Dager, textual"
  leadsTo: [otro-libro]        # qué leer después (de nivel mayor)
  related:
    - id: libro-de-otra-linea
      reason: "Por qué se conectan"
`;

const ZONES = [
  { level: 1, name: "Introductorio", text: "Para arrancar de cero. Sin requisitos." },
  { level: 2, name: "Intermedio", text: "Ya tenés la base y querés más." },
  { level: 3, name: "Avanzado", text: "Pide oficio y varias lecturas previas." },
  { level: 4, name: "Especialista", text: "Para meterse a fondo en un tema." },
];

export default function SumarUnLibroPage() {
  const lines = allLines();

  return (
    <PageShell crumbs={[{ label: "Sumá un libro" }]}>
      <article className={styles.page}>
        <header className={styles.head}>
          <h1 className={styles.title}>Sumá un libro a la red</h1>
          <p className={styles.lead}>
            Cualquiera puede proponer un libro que Dager recomendó. Entra por un Pull Request en GitHub y el dueño del
            mapa lo revisa antes de que salga al aire.
          </p>
        </header>

        <ol className={styles.route}>
          <li className={styles.stop}>
            <h2 className={styles.stopTitle}>Fijate que no esté</h2>
            <p>
              Mirá el <Link href="/estaciones">directorio de estaciones</Link> o usá el buscador del mapa. Si ya está,
              ahorraste un PR.
            </p>
          </li>

          <li className={styles.stop}>
            <h2 className={styles.stopTitle}>Abrí el catálogo en GitHub</h2>
            <p>
              Entrá a{" "}
              <a href={BOOKS_YAML} target="_blank" rel="noopener noreferrer">
                <code className={styles.inline}>content/books.yaml</code>
              </a>{" "}
              y tocá el lápiz (<strong>Edit</strong>). GitHub te crea el fork solo.
            </p>
          </li>

          <li className={styles.stop}>
            <h2 className={styles.stopTitle}>Copiá la plantilla al final de la lista</h2>
            <p>
              Pegala abajo de todo y completá. Los cuatro primeros campos son obligatorios; el resto, si lo sabés.
            </p>
            <div className={styles.code}>
              <div className={styles.codeBar}>
                <span className={styles.codeName}>books.yaml</span>
                <CopyButton text={TEMPLATE} />
              </div>
              <pre className={styles.pre} tabIndex={0} aria-label="Plantilla YAML de un libro">
                <code>{TEMPLATE}</code>
              </pre>
            </div>
            <p className={styles.hint}>
              En <code className={styles.inline}>sources</code>, la URL lleva <code className={styles.inline}>&amp;t=</code>{" "}
              con los segundos exactos para que el link caiga en el minuto en que Dager lo menciona.
            </p>
          </li>

          <li className={styles.stop}>
            <h2 className={styles.stopTitle}>Elegí la línea y la zona</h2>
            <p>
              En <code className={styles.inline}>topics</code> va el id de la línea, tal cual. El primero decide dónde se
              dibuja.
            </p>
            <ul className={styles.lines}>
              {lines.map((l) => (
                <li key={l.topicId} className={styles.lineRow}>
                  <LineDisc letter={l.letter} color={l.color} size="sm" />
                  <span className={styles.lineName}>{l.name}</span>
                  <code className={styles.chip}>{l.topicId}</code>
                </li>
              ))}
            </ul>
            <p className={styles.zonesIntro}>
              En <code className={styles.inline}>level</code> va la zona, de adentro hacia afuera:
            </p>
            <dl className={styles.zones}>
              {ZONES.map((z) => (
                <div key={z.level} className={styles.zone}>
                  <dt>
                    <code className={styles.chip}>{z.level}</code> {z.name}
                  </dt>
                  <dd>{z.text}</dd>
                </div>
              ))}
            </dl>
          </li>

          <li className={styles.stop}>
            <h2 className={styles.stopTitle}>Mandá el PR</h2>
            <p>
              <strong>Propose changes</strong>, después <strong>Create pull request</strong>. En la descripción contá en
              qué video lo recomienda Dager, con el link al minuto.
            </p>
          </li>

          <li className={styles.stop} data-terminal="true">
            <h2 className={styles.stopTitle}>Esperá la revisión</h2>
            <p>
              Vercel arma una vista previa y valida el YAML solo: si un campo está mal, el error te dice qué libro y
              qué campo. Después el dueño lo aprueba y el libro aparece en el mapa.
            </p>
          </li>
        </ol>

        <div className={styles.notes}>
          <section className={styles.note} aria-labelledby="no-sabes">
            <h2 id="no-sabes" className={styles.noteTitle}>
              Si no sabés todo
            </h2>
            <p>
              Alcanza con <code className={styles.inline}>id</code>, <code className={styles.inline}>title</code>,{" "}
              <code className={styles.inline}>topics</code> y <code className={styles.inline}>level</code>. Lo que
              falte se muestra como <strong>por completar</strong> y otra persona puede sumarlo después.
            </p>
          </section>

          <section className={styles.note} data-kind="rules" aria-labelledby="reglas">
            <h2 id="reglas" className={styles.noteTitle}>
              La regla de la red
            </h2>
            <p>
              El libro tiene que ser uno que Dager <strong>recomienda de verdad</strong>. Si apenas lo nombra o lo
              critica, no entra. Y si hay fuente (video con minuto), mejor.
            </p>
          </section>
        </div>

        <div className={styles.actions}>
          <ArrowLink href={BOOKS_YAML}>Abrir books.yaml en GitHub</ArrowLink>
          <ArrowLink href="/" variant="ghost" direction="left">
            Volver al mapa
          </ArrowLink>
        </div>
      </article>
    </PageShell>
  );
}
