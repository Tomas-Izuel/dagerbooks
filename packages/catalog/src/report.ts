/**
 * Mensajes de validación. Son para quien edita el YAML: nombran la entidad, el campo y el problema.
 * Formatos:
 *   `libro "x" › leadsTo[0]: …`   (at)
 *   `actualización "x": …`        (entity)
 *   `catálogo › level: …`         (catalog)
 */
export type Noun = "libro" | "tema" | "ruta" | "actualización";

export class Reporter {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];

  at(noun: Noun, id: string, field: string, msg: string) {
    this.errors.push(`${noun} "${id}" › ${field}: ${msg}`);
  }
  entity(noun: Noun, id: string, msg: string) {
    this.errors.push(`${noun} "${id}": ${msg}`);
  }
  catalog(field: string, msg: string) {
    this.errors.push(`catálogo › ${field}: ${msg}`);
  }
  warnAt(noun: Noun, id: string, field: string, msg: string) {
    this.warnings.push(`${noun} "${id}" › ${field}: ${msg}`);
  }
}
