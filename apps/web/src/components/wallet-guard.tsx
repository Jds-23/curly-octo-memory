import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { PortoAuth } from "@/components/porto-auth";
import { Button } from "@/components/ui/button";

interface WalletGuardProps {
	children: ReactNode;
	fallback?: ReactNode;
}

export function WalletGuard({ children, fallback }: WalletGuardProps) {
	const { isConnected } = useAccount();

	if (!isConnected) {
		if (fallback) {
			return <>{fallback}</>;
		}

		return (
			<div className="container mx-auto max-w-2xl px-4 py-8">
				<div className="space-y-6 text-center">
					<div className="space-y-2">
						<h1 className="font-bold text-2xl">Connect Your Wallet</h1>
						<p className="text-muted-foreground">
							You need to connect your wallet to view your positions.
						</p>
					</div>
					<div className="mx-auto max-w-md">
						<PortoAuth />
					</div>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
