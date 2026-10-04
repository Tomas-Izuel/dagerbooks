import { CatalogError, loadCatalog } from "../lib/catalog/load";

try {
  const { books, topics, warnings } = loadCatalog();
  const low = books.filter((b) => b.confidence === "low");
  console.log(`OK: ${books.length} libros, ${topics.length} temas, ${low.length} por completar.`);
  if (warnings.length) {
    console.warn(`\nAvisos (${warnings.length}):`);
    for (const w of warnings) console.warn(`  - ${w}`);
  }
} catch (e) {
  if (e instanceof CatalogError) {
    console.error(`\n${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
