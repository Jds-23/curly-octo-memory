import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface PositionData {
	tokenId: string;
	tickLower: number;
	tickUpper: number;
	liquidity: string;
	poolKey: {
		currency0: string;
		currency1: string;
		fee: number;
		tickSpacing: number;
		hooks: string;
	};
}

interface PositionCardProps {
	position: PositionData;
}

export function PositionCard({ position }: PositionCardProps) {
	const { tokenId, tickLower, tickUpper, liquidity, poolKey } = position;
	const feePercentage = (poolKey.fee / 10000).toFixed(2);

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

	return (
		<Card className="space-y-4 p-6">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<h3 className="font-semibold">Position #{tokenId}</h3>
					<p className="text-muted-foreground text-sm">
						{formatAddress(poolKey.currency0)} /{" "}
						{formatAddress(poolKey.currency1)}
					</p>
				</div>
				<Badge variant="secondary">{feePercentage}% Fee</Badge>
			</div>

			<div className="grid grid-cols-2 gap-4 text-sm">
				<div className="space-y-2">
					<div>
						<span className="text-muted-foreground">Tick Range</span>
						<p className="font-mono">
							{tickLower} → {tickUpper}
						</p>
					</div>
					<div>
						<span className="text-muted-foreground">Liquidity</span>
						<p className="font-mono">{formatLiquidity(liquidity)}</p>
					</div>
				</div>
				<div className="space-y-2">
					<div>
						<span className="text-muted-foreground">Tick Spacing</span>
						<p className="font-mono">{poolKey.tickSpacing}</p>
					</div>
					<div>
						<span className="text-muted-foreground">Hooks</span>
						<p className="font-mono text-xs">
							{poolKey.hooks === "0x0000000000000000000000000000000000000000"
								? "None"
								: formatAddress(poolKey.hooks)}
						</p>
					</div>
				</div>
			</div>

			<div className="border-t pt-2">
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<span>Token0: {formatAddress(poolKey.currency0)}</span>
					<span>Token1: {formatAddress(poolKey.currency1)}</span>
				</div>
			</div>
		</Card>
	);
}
