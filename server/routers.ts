import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { listTripsByOwner, unlockStickerForOwner } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  trips: router({
    mine: protectedProcedure.query(({ ctx }) => listTripsByOwner(ctx.user.id)),
    unlockSticker: protectedProcedure
      .input(z.object({ token: z.string().min(8).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const sticker = await unlockStickerForOwner(ctx.user.id, input.token);
        if (!sticker) return { success: false as const, sticker: null };
        return { success: true as const, sticker };
      }),
  }),
});

export type AppRouter = typeof appRouter;
