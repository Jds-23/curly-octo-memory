import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface Token {
	chainId: number;
	address: string;
	symbol: string;
	decimals: number;
	name: string;
	isNative?: boolean;
}

interface PositionData {
	tokenId: string;
	chainId: number;
	protocolVersion: string;
	status: string;
	timestamp: number;
	tickLower: number;
	tickUpper: number;
	liquidity: string;
	token0: Token;
	token1: Token;
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

interface PositionCardProps {
	position: PositionData;
}

export function PositionCard({ position }: PositionCardProps) {
	const {
		tokenId,
		chainId,
		protocolVersion,
		status,
		tickLower,
		tickUpper,
		liquidity,
		token0,
		token1,
		feeTier,
		currentTick,
		totalLiquidityUsd,
		apr,
		totalApr,
		token0UncollectedFees,
		token1UncollectedFees,
		hooks,
	} = position;
	const feePercentage = (feeTier / 10000).toFixed(2);

	const formatAddress = (address: string) => {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	};

	const formatLiquidity = (liquidityStr: string) => {
		const num = BigInt(liquidityStr);
		if (num === 0n) return "0";

		// Simple formatting for large numbers
		const str = num.toString();
		if (str.length > 18) {
			return `${str.slice(0, -18)}.${str.slice(-18, -15)}M+`;
		}
		if (str.length > 15) {
			return `${str.slice(0, -15)}.${str.slice(-15, -12)}K+`;
		}
		return str;
	};

	const getChainName = (chainId: number) => {
		const chains: { [key: number]: string } = {
			1: "Ethereum",
			130: "Unichain",
			8453: "Base",
			42161: "Arbitrum",
			137: "Polygon",
			10: "Optimism",
			56: "BSC",
			43114: "Avalanche",
		};
		return chains[chainId] || `Chain ${chainId}`;
	};

	const getProtocolBadge = () => {
		const version = protocolVersion.replace("PROTOCOL_VERSION_", "");
		const variant = version === "V4" ? "default" : "secondary";
		return <Badge variant={variant}>{version}</Badge>;
	};

	const getStatusBadge = () => {
		const inRange = status === "POSITION_STATUS_IN_RANGE";
		return (
			<Badge variant={inRange ? "default" : "outline"}>
				{inRange ? "In Range" : "Out of Range"}
			</Badge>
		);
	};

	const formatUSD = (value: string) => {
		const num = Number.parseFloat(value);
		if (num >= 1000000) {
			return `$${(num / 1000000).toFixed(2)}M`;
		}
		if (num >= 1000) {
			return `$${(num / 1000).toFixed(2)}K`;
		}
		return `$${num.toFixed(2)}`;
	};

	const formatFees = (fees: string, decimals: number) => {
		const num = Number.parseFloat(fees) / 10 ** decimals;
		return num.toFixed(6);
	};

	return (
		<Card className="space-y-4 p-6">
			{/* Header */}
			<div className="flex items-start justify-between">
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<h3 className="font-semibold">#{tokenId}</h3>
						{getProtocolBadge()}
						{getStatusBadge()}
					</div>
					<p className="text-muted-foreground text-sm">
						{token0.symbol} / {token1.symbol}
					</p>
					<p className="text-muted-foreground text-xs">
						{getChainName(chainId)} • {feePercentage}% Fee
					</p>
				</div>
				<div className="space-y-1 text-right">
					<p className="font-semibold text-lg">
						{formatUSD(totalLiquidityUsd)}
					</p>
					<p className="font-medium text-green-600 text-sm">
						{totalApr.toFixed(2)}% APR
					</p>
				</div>
			</div>

			{/* Position Details */}
			<div className="grid grid-cols-2 gap-4 text-sm">
				<div className="space-y-2">
					<div>
						<span className="text-muted-foreground">Tick Range</span>
						<p className="font-mono">
							{tickLower.toLocaleString()} → {tickUpper.toLocaleString()}
						</p>
					</div>
					<div>
						<span className="text-muted-foreground">Current Tick</span>
						<p className="font-mono">{currentTick.toLocaleString()}</p>
					</div>
					<div>
						<span className="text-muted-foreground">Liquidity</span>
						<p className="font-mono">{formatLiquidity(liquidity)}</p>
					</div>
				</div>
				<div className="space-y-2">
					<div>
						<span className="text-muted-foreground">Tick Spacing</span>
						<p className="font-mono">{position.tickSpacing}</p>
					</div>
					<div>
						<span className="text-muted-foreground">Pool ID</span>
						<p className="font-mono text-xs">
							{formatAddress(position.poolId)}
						</p>
					</div>
					<div>
						<span className="text-muted-foreground">Hooks</span>
						<p className="font-mono text-xs">
							{hooks.length > 0 &&
							hooks[0] !== "0x0000000000000000000000000000000000000000"
								? hooks.map((h) => formatAddress(h)).join(", ")
								: "None"}
						</p>
					</div>
				</div>
			</div>

			{/* Uncollected Fees */}
			{(Number.parseFloat(token0UncollectedFees) > 0 ||
				Number.parseFloat(token1UncollectedFees) > 0) && (
				<div className="border-t pt-3">
					<h4 className="mb-2 font-medium text-sm">Uncollected Fees</h4>
					<div className="grid grid-cols-2 gap-4 text-sm">
						<div>
							<span className="text-muted-foreground">{token0.symbol}</span>
							<p className="font-mono">
								{formatFees(token0UncollectedFees, token0.decimals)}
							</p>
						</div>
						<div>
							<span className="text-muted-foreground">{token1.symbol}</span>
							<p className="font-mono">
								{formatFees(token1UncollectedFees, token1.decimals)}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Footer */}
			<div className="border-t pt-2">
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>
						{token0.name} ({formatAddress(token0.address)})
					</span>
					<span>
						{token1.name} ({formatAddress(token1.address)})
					</span>
				</div>
			</div>
		</Card>
	);
}
