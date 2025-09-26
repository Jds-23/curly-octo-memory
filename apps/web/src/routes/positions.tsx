import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, RefreshCw, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { EmptyState } from "@/components/empty-state";
import { PositionCard } from "@/components/position-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletGuard } from "@/components/wallet-guard";
import { trpc } from "@/utils/trpc";

// Explicitly define the enhanced position type to match the API response
interface EnhancedPositionData {
	tokenId: string;
	chainId: number;
	protocolVersion: string;
	status: string;
	timestamp: number;
	tickLower: number;
	tickUpper: number;
	liquidity: string;
	token0: {
		chainId: number;
		address: string;
		symbol: string;
		decimals: number;
		name: string;
		isNative?: boolean;
	};
	token1: {
		chainId: number;
		address: string;
		symbol: string;
		decimals: number;
		name: string;
		isNative?: boolean;
	};
	feeTier: number;
	currentTick: number;
	currentPrice: string;
	tickSpacing: number;
	token0UncollectedFees: string;
	token1UncollectedFees: string;
	amount0: string;
	amount1: string;
	poolId: string;
	totalLiquidityUsd: string;
	currentLiquidity: string;
	apr: number;
	totalApr: number;
	hooks: string[];
}

export const Route = createFileRoute("/positions")({
	component: PositionsComponent,
});

function PositionsComponent() {
	return (
		<WalletGuard>
			<PositionsContent />
		</WalletGuard>
	);
}

function PositionsContent() {
	const { address } = useAccount();

	const {
		data: positionsData,
		isLoading,
		error,
		refetch,
		isFetching,
	} = useQuery(
		trpc.uniswap.getPositions.queryOptions({
			owner: address!,
		}),
	);

	const handleRefresh = () => {
		refetch();
	};

	const handleCreatePosition = () => {
		// Navigate to our mint position page
		window.location.href = "/mint-position";
	};

	if (isLoading) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-10 w-24" />
					</div>
					<div className="grid gap-6 md:grid-cols-2">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={i} className="h-48 w-full" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<EmptyState
					icon={<Wallet className="h-12 w-12" />}
					title="Error Loading Positions"
					description={
						error.message.includes("auth error")
							? "Unable to fetch positions. The Graph API requires authentication. Please contact support for API access."
							: `Failed to load your positions: ${error.message}`
					}
					action={{
						label: "Try Again",
						onClick: handleRefresh,
					}}
				/>
			</div>
		);
	}

	const positions = (positionsData?.positions ||
		[]) as unknown as EnhancedPositionData[];
	const hasPositions = positions.length > 0;

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			<div className="space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<h1 className="font-bold text-2xl">My Positions</h1>
						<p className="text-muted-foreground">
							{hasPositions
								? `You have ${positions.length} active position${
										positions.length === 1 ? "" : "s"
									}`
								: "Manage your Uniswap v4 liquidity positions"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleRefresh}
							disabled={isFetching}
						>
							<RefreshCw
								className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
							/>
							Refresh
						</Button>
						<Button onClick={handleCreatePosition}>
							<Plus className="mr-1 h-4 w-4" />
							Create Position
						</Button>
					</div>
				</div>

				{/* Content */}
				{!hasPositions ? (
					<EmptyState
						icon={<Wallet className="h-12 w-12" />}
						title="No Positions Found"
						description="You don't have any Uniswap v4 positions yet. Create your first position to start earning fees from providing liquidity."
						action={{
							label: "Create Position",
							onClick: handleCreatePosition,
						}}
					>
						<div className="mt-4 text-muted-foreground text-sm">
							<p>
								Positions will appear here once you create them on Uniswap v4.
							</p>
						</div>
					</EmptyState>
				) : (
					<div className="grid gap-6 md:grid-cols-2">
						{positions.map((position) => (
							<PositionCard key={position.tokenId} position={position} />
						))}
					</div>
				)}

				{/* Footer Info */}
				{hasPositions && (
					<div className="border-t pt-6 text-center text-muted-foreground text-sm">
						<p>
							Positions are fetched from Unichain. Data may take a few minutes
							to update after transactions.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
