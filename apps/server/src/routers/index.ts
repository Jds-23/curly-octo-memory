import { publicProcedure, router } from "../lib/trpc";
import { balancesRouter } from "./balances";
import { currenciesRouter } from "./currencies";
import { uniswapRouter } from "./uniswap";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => {
		return "OK";
	}),
	uniswap: uniswapRouter,
	currencies: currenciesRouter,
	balances: balancesRouter,
});
export type AppRouter = typeof appRouter;
