import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(user: TrpcContext["user"]): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("travel routes", () => {
  it("protects the personal trips feed", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.trips.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects tokens shorter than the minimum scan length", async () => {
    const caller = appRouter.createCaller(context({ id: 1, openId: "demo", email: null, name: "Demo", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }));
    await expect(caller.trips.unlockSticker({ token: "short" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
