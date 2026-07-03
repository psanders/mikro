/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "@mikro/common/schemas";
import type { NavMode } from "../auth";

const mockGetRoles = jest.fn<Promise<Role[]>, []>();
const mockGetNavMode = jest.fn<Promise<NavMode>, []>();

jest.mock("../auth", () => {
  const actual = jest.requireActual("../auth");
  return {
    ...actual,
    getRoles: () => mockGetRoles(),
    getNavMode: () => mockGetNavMode()
  };
});

import { resolveHomeRoute, EVALUATOR_HOME, COLLECTOR_HOME } from "../navigation";

describe("resolveHomeRoute", () => {
  beforeEach(() => {
    mockGetRoles.mockReset();
    mockGetNavMode.mockReset();
    mockGetNavMode.mockResolvedValue("evaluator");
  });

  it("routes COLLECTOR-only users to the collector home", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR"]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("routes REVIEWER-only users to the evaluator home", async () => {
    mockGetRoles.mockResolvedValue(["REVIEWER"]);
    await expect(resolveHomeRoute()).resolves.toBe(EVALUATOR_HOME);
  });

  it("routes ADMIN-only users to the evaluator home by default", async () => {
    mockGetRoles.mockResolvedValue(["ADMIN"]);
    mockGetNavMode.mockResolvedValue("evaluator");
    await expect(resolveHomeRoute()).resolves.toBe(EVALUATOR_HOME);
  });

  // mikro/#70: ADMIN-only counts as dual-role (server-side access to both
  // surfaces), so the Perfil switcher's stored preference must route them too.
  it("respects a stored 'collector' nav mode override for ADMIN-only users", async () => {
    mockGetRoles.mockResolvedValue(["ADMIN"]);
    mockGetNavMode.mockResolvedValue("collector");
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("routes dual-role (COLLECTOR + REVIEWER) users to the evaluator home by default", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR", "REVIEWER"]);
    mockGetNavMode.mockResolvedValue("evaluator");
    await expect(resolveHomeRoute()).resolves.toBe(EVALUATOR_HOME);
  });

  it("respects a stored 'collector' nav mode override for dual-role users", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR", "REVIEWER"]);
    mockGetNavMode.mockResolvedValue("collector");
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("respects an explicit 'evaluator' nav mode override for dual-role users", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR", "ADMIN"]);
    mockGetNavMode.mockResolvedValue("evaluator");
    await expect(resolveHomeRoute()).resolves.toBe(EVALUATOR_HOME);
  });

  it("does not consult nav mode for single-role (non-dual) users", async () => {
    mockGetRoles.mockResolvedValue(["REVIEWER"]);
    await resolveHomeRoute();
    expect(mockGetNavMode).not.toHaveBeenCalled();
  });

  it("routes users with no roles to the collector home", async () => {
    mockGetRoles.mockResolvedValue([]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });
});
