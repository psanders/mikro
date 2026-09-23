/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Role } from "@mikro/common/schemas";

const mockGetRoles = jest.fn<Promise<Role[]>, []>();

jest.mock("../auth", () => {
  const actual = jest.requireActual("../auth");
  return { ...actual, getRoles: () => mockGetRoles() };
});

import { resolveHomeRoute, COLLECTOR_HOME, USE_OPS_ROUTE } from "../navigation";

describe("resolveHomeRoute", () => {
  beforeEach(() => mockGetRoles.mockReset());

  it("routes COLLECTOR-only users to the collector home", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR"]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("routes ADMIN users to the collector home (review lives in the Ops app)", async () => {
    mockGetRoles.mockResolvedValue(["ADMIN"]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("routes COLLECTOR + REVIEWER users to the collector home", async () => {
    mockGetRoles.mockResolvedValue(["COLLECTOR", "REVIEWER"]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });

  it("points REVIEWER-only users to the Ops app", async () => {
    mockGetRoles.mockResolvedValue(["REVIEWER"]);
    await expect(resolveHomeRoute()).resolves.toBe(USE_OPS_ROUTE);
  });

  it("routes users with no roles to the collector home", async () => {
    mockGetRoles.mockResolvedValue([]);
    await expect(resolveHomeRoute()).resolves.toBe(COLLECTOR_HOME);
  });
});
