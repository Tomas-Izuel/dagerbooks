import { initBotId } from "botid/client/core";

// BotID protege el POST del formulario de sugerencias (la server action se envía a la página).
initBotId({ protect: [{ path: "/sumar-un-libro", method: "POST" }] });
