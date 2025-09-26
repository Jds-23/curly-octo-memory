import { publicProcedure, router } from "../lib/trpc";
import { uniswapRouter } from "./uniswap";
import { currenciesRouter } from "./currencies";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	uniswap: uniswapRouter,
	currencies: currenciesRouter,
});
export type AppRouter = typeof appRouter;
