import { Button } from '@/components/ui/button';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useEffect } from 'react';

export function PortoAuth() {
	const { address, isConnected, chainId } = useAccount();
	const { connect, connectors, error, isPending } = useConnect();
	const { disconnect } = useDisconnect();

	// Find Porto connector
	const portoConnector = connectors.find(
		connector => connector.name === 'Porto' || connector.id === 'porto'
	);

	// Find other connectors
	const injectedConnector = connectors.find(
		connector => connector.name === 'Injected' || connector.id === 'injected'
	);

	const walletConnectConnector = connectors.find(
		connector => connector.name === 'WalletConnect' || connector.id === 'walletConnect'
	);

	if (isConnected && address) {
		return (
			<div className="rounded-lg border p-4 space-y-4">
				<h3 className="font-medium">Connected Wallet</h3>
				<div className="space-y-2">
					<p className="text-sm">
						<span className="font-medium">Address:</span>{' '}
						<code className="bg-muted px-1 py-0.5 rounded text-xs">
							{address.slice(0, 6)}...{address.slice(-4)}
						</code>
					</p>
					{chainId && (
						<p className="text-sm">
							<span className="font-medium">Chain ID:</span> {chainId}
						</p>
					)}
				</div>
				<Button onClick={() => disconnect()} variant="outline" size="sm">
					Disconnect
				</Button>
			</div>
		);
	}

	return (
		<div className="rounded-lg border p-4 space-y-4">
			<h3 className="font-medium">Connect Your Wallet</h3>
			<div className="space-y-2">
				{/* Porto Sign In Button */}
				{portoConnector && (
					<Button
						onClick={() => connect({ connector: portoConnector })}
						disabled={isPending}
						className="w-full bg-blue-600 hover:bg-blue-700 text-white"
					>
						{isPending ? 'Connecting...' : 'Sign in with Porto'}
					</Button>
				)}

				{/* Injected Wallet (MetaMask, etc.) */}
				{injectedConnector && (
					<Button
						onClick={() => connect({ connector: injectedConnector })}
						disabled={isPending}
						variant="outline"
						className="w-full"
					>
						{isPending ? 'Connecting...' : 'Connect MetaMask'}
					</Button>
				)}

				{/* WalletConnect */}
				{walletConnectConnector && (
					<Button
						onClick={() => connect({ connector: walletConnectConnector })}
						disabled={isPending}
						variant="outline"
						className="w-full"
					>
						{isPending ? 'Connecting...' : 'WalletConnect'}
					</Button>
				)}
			</div>

			{error && (
				<div className="text-sm text-red-500 mt-2">
					Error: {error.message}
				</div>
			)}
		</div>
	);
}