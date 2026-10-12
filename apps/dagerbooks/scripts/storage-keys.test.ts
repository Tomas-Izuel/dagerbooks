/**
 * Las claves de localStorage guardan el progreso de los lectores: si cambian, lo pierden.
 * Este test fija los strings exactos que usa producción.
 */
import assert from "node:assert/strict";
import { it } from "node:test";
import { BOARD_COLLAPSED_KEY } from "../hooks/useBoardCollapsed";
import { DENSITY_STORAGE_KEY } from "../lib/density";
import { ROUTES_STORAGE_KEY } from "../hooks/useFollowedRoutes";
import { READ_STORAGE_KEY } from "../hooks/useReadProgress";
import { SEEN_UPDATE_KEY } from "../hooks/useSeenUpdate";

it("las claves de localStorage no cambian", () => {
  assert.equal(READ_STORAGE_KEY, "dagerbooks:read:v1");
  assert.equal(ROUTES_STORAGE_KEY, "dagerbooks:routes:v1");
  assert.equal(SEEN_UPDATE_KEY, "dagerbooks:update-seen:v1");
  assert.equal(DENSITY_STORAGE_KEY, "dagerbooks:density:v1");
  assert.equal(BOARD_COLLAPSED_KEY, "dagerbooks:board-collapsed:v1");
});
