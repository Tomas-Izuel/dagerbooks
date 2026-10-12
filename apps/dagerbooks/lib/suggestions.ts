import "server-only";
import { createBookMatcher } from "@estantes/kit";
import { createGithubIssueCreator, createRateLimit, githubAppFromEnv } from "@estantes/kit/server";
import { getBooks } from "@/lib/catalog/queries";

/** Config de la GitHub App del repo de sugerencias (variables de entorno). Sin ella, la página muestra la guía por PR. */
const github = githubAppFromEnv();

export const SUGGESTIONS_ENABLED = github !== null;

export const createIssue = github ? createGithubIssueCreator(github) : null;

/** Hasta 5 sugerencias por IP cada 10 minutos. */
export const suggestionLimit = createRateLimit({ limit: 5, windowSeconds: 600, prefix: "dagerbooks:suggest" });

let matcher: ReturnType<typeof createBookMatcher> | undefined;
export const findBook = (title: string) => (matcher ??= createBookMatcher(getBooks()))(title);
