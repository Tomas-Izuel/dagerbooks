"use server";

import { headers } from "next/headers";
import { checkBotId } from "botid/server";
import { createSuggestion, type SuggestionResult } from "@estantes/kit";
import config from "@/creator.config";
import { createIssue, findBook, suggestionLimit } from "@/lib/suggestions";

export type SuggestState = SuggestionResult | { status: "idle" };

/** Sugerencia de un libro: valida, se fija si ya está, frena bots y ráfagas, y abre un issue en el repo de sugerencias. */
export async function suggestBook(_prev: SuggestState, form: FormData): Promise<SuggestState> {
  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  return createSuggestion(form, {
    creatorId: config.id,
    channelKinds: config.channels.map((c) => c.kind),
    findBook,
    isBot: async () => (await checkBotId()).isBot,
    allow: () => suggestionLimit.allow(ip),
    createIssue,
  });
}
