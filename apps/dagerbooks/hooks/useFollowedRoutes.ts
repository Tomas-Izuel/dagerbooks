"use client";

import { createFollowedRoutes } from "@estantes/kit/react";
import config from "@/creator.config";

export type { FollowedRoutes } from "@estantes/kit/react";

/** Rutas seguidas: `dagerbooks:routes:v1`. */
export const { key: ROUTES_STORAGE_KEY, useFollowedRoutes } = createFollowedRoutes(config.storageNamespace);
