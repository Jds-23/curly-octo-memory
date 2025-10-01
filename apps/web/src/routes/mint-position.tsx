import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { MintPositionForm } from "@/components/mint-position-form";
import { Button } from "@/components/ui/button";
import { WalletGuard } from "@/components/wallet-guard";

export const Route = createFileRoute("/mint-position")({
	component: MintPositionComponent,
});

function MintPositionComponent() {
	return (
		<WalletGuard>
			<MintPositionContent />
		</WalletGuard>
	);
}

function MintPositionContent() {
	const router = useRouter();

	const handleSuccess = () => {
		// Navigate back to positions page after successful mint
		router.navigate({ to: "/positions" });
	};

	const handleBack = () => {
		router.navigate({ to: "/positions" });
	};

	return (
		<div className="container mx-auto max-w-2xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 space-y-4">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleBack}
					className="gap-2"
				>
					<ArrowLeft className="h-4 w-4" />
					Back to Positions
				</Button>
				<div>
					<h1 className="font-bold text-3xl">Create Liquidity Position</h1>
					<p className="text-muted-foreground">
						Add liquidity to Uniswap v4 and earn fees from trades
					</p>
				</div>
			</div>

			{/* Form */}
			<MintPositionForm onSuccess={handleSuccess} />

			{/* Info Section */}
			<div className="mt-8 space-y-4 text-center text-muted-foreground text-sm">
				<p>
					Liquidity positions are represented as NFTs. You'll earn fees
					proportional to your share of the pool.
				</p>
				<p>
					Make sure to have enough tokens in your wallet and approve the
					position manager contract to spend your tokens.
				</p>
			</div>
		</div>
	);
}
