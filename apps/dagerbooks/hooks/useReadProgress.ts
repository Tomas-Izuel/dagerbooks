"use client";

import { createReadProgress } from "@estantes/kit/react";
import config from "@/creator.config";

export type { ReadProgress } from "@estantes/kit/react";

/** "Lo leí": `dagerbooks:read:v1`. La clave no puede cambiar sin perder el progreso de los lectores. */
export const { key: READ_STORAGE_KEY, useReadProgress } = createReadProgress(config.storageNamespace);
