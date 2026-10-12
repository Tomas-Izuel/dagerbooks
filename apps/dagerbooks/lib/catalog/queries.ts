import { createQueries } from "@estantes/catalog";
import { loadCatalog } from "./load";

export const {
  getBooks,
  getTopics,
  getUpdates,
  getRoutes,
  getRoute,
  getRoot,
  getBook,
  getTopic,
  booksInTopic,
  booksInSector,
  directPrerequisites,
  directUnlocks,
  prerequisiteChain,
  unlockedBy,
  relatedBooks,
  isEntryPoint,
  implicitRootEdges,
} = createQueries(loadCatalog);
