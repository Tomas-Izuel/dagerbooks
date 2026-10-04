import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { LineDisc } from "@/components/ui/LineDisc";
import { ArrowLink } from "./ArrowLink";
import { Dotted } from "./Dotted";
import styles from "./SiteHeader.module.css";

export interface Crumb {
  label: string;
  href?: string;
  /** Disco de línea que antecede a la miga. */
  line?: { letter: string; color: string };
}


export function SiteHeader({ crumbs = [] }: { crumbs?: Crumb[] }) {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <Link href="/" className={styles.wordmark}>
          <Logo size={30} />
          <span>DagerBooks</span>
        </Link>
        <ArrowLink href="/" direction="left" variant="ghost">
          Volver al mapa
        </ArrowLink>
      </div>
      {crumbs.length ? (
        <nav aria-label="Migas de pan" className={styles.crumbs}>
          <ol>
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              const body = (
                <>
                  {c.line ? <LineDisc letter={c.line.letter} color={c.line.color} size="sm" /> : null}
                  <span data-crumb-label="">
                    <Dotted parts={c.label.split(" · ")} />
                  </span>
                </>
              );
              return (
                <li key={`${c.label}-${i}`}>
                  {c.href && !last ? (
                    <Link href={c.href}>{body}</Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined}>{body}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
    </header>
  );
}
