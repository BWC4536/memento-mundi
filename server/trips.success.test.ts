import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listTripsByOwner: vi.fn(), unlockStickerForOwner: vi.fn() }));
vi.mock("./db", () => mocks);

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const user = { id: 7, openId: "traveler-7", email: "traveler@example.com", name: "Traveler", loginMethod: "test", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const ctx = { user, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;

describe("travel success paths", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the trips owned by the authenticated user", async () => {
    mocks.listTripsByOwner.mockResolvedValue([{ id: 1, ownerId: 7, title: "Postales del Atlántico" }]);
    const result = await appRouter.createCaller(ctx).trips.mine();
    expect(mocks.listTripsByOwner).toHaveBeenCalledWith(7);
    expect(result[0]?.title).toBe("Postales del Atlántico");
  });

  it("returns the unlocked sticker after a valid token", async () => {
    mocks.unlockStickerForOwner.mockResolvedValue({ id: 4, ownerId: 7, tripId: 1, tokenHash: "lisboa-7f3a", title: "Mirador", unlockedAt: new Date() });
    const result = await appRouter.createCaller(ctx).trips.unlockSticker({ token: "lisboa-7f3a" });
    expect(mocks.unlockStickerForOwner).toHaveBeenCalledWith(7, "lisboa-7f3a");
    expect(result.success).toBe(true);
    expect(result.sticker?.title).toBe("Mirador");
  });
});
