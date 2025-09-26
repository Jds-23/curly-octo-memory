import { publicProcedure, router } from "../lib/trpc";
import { uniswapRouter } from "./uniswap";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	uniswap: uniswapRouter,
});
export type AppRouter = typeof appRouter;
