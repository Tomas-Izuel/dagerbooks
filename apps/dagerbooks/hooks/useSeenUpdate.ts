"use client";

import { createSeenUpdate } from "@estantes/kit/react";
import config from "@/creator.config";

/** Última novedad vista: `dagerbooks:update-seen:v1`. */
export const { key: SEEN_UPDATE_KEY, useSeenUpdate } = createSeenUpdate(config.storageNamespace);
