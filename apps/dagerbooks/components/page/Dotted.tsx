import { Fragment } from "react";
import styles from "./Dotted.module.css";

/** Une partes con un punto medio con aire a ambos lados (el espacio de texto se pierde en la fuente de carteles). */
export function Dotted({ parts }: { parts: (string | null | undefined | false)[] }) {
  const items = parts.filter((p): p is string => Boolean(p));
  return (
    <>
      {items.map((p, i) => (
        <Fragment key={`${p}-${i}`}>
          {i > 0 ? (
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
          ) : null}
          {i > 0 ? <span className={styles.sr}>, </span> : null}
          {p}
        </Fragment>
      ))}
    </>
  );
}
