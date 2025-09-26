import { publicProcedure, router } from "../lib/trpc";
import { currenciesRouter } from "./currencies";
import { uniswapRouter } from "./uniswap";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	uniswap: uniswapRouter,
	currencies: currenciesRouter,
});
export type AppRouter = typeof appRouter;
