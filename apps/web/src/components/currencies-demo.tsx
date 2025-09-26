import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useCurrencyByAddress,
	useDefaultCurrencies,
	useSearchCurrencies,
} from "@/hooks/use-currencies";

export function CurrenciesDemo() {
	const [searchTerm, setSearchTerm] = useState("");
	const [addressLookup, setAddressLookup] = useState("");

	// Get default currencies for Ethereum
	const { data: defaultCurrencies, isLoading: loadingDefault } =
		useDefaultCurrencies([1], 10);

	// Search currencies
	const { data: searchResults, isLoading: loadingSearch } =
		useSearchCurrencies(searchTerm);

	// Lookup by address
	const { data: addressResult, isLoading: loadingAddress } =
		useCurrencyByAddress(addressLookup);

	return (
		<div className="space-y-6 p-4">
			<h2 className="font-bold text-2xl">Currencies API Demo</h2>

			{/* Default Currencies */}
			<Card className="p-4">
				<h3 className="mb-4 font-semibold text-lg">Popular Ethereum Tokens</h3>
				{loadingDefault ? (
					<div className="space-y-2">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				) : (
					<div className="space-y-2">
						{defaultCurrencies?.currencies?.map((currency) => (
							<div
								key={`${currency.chainId}-${currency.address}`}
								className="flex items-center justify-between rounded-lg border p-3"
							>
								<div className="flex items-center gap-3">
									{currency.metadata.logoURI && (
										<img
											src={currency.metadata.logoURI}
											alt={currency.symbol}
											className="h-8 w-8 rounded-full"
										/>
									)}
									<div>
										<div className="font-medium">{currency.symbol}</div>
										<div className="text-muted-foreground text-sm">
											{currency.name}
										</div>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Badge variant="secondary">Chain {currency.chainId}</Badge>
									{currency.metadata.verified && (
										<Badge variant="default">Verified</Badge>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</Card>

			{/* Search */}
			<Card className="p-4">
				<h3 className="mb-4 font-semibold text-lg">Search Tokens</h3>
				<div className="mb-4 flex gap-2">
					<input
						type="text"
						placeholder="Search tokens (e.g., USDC, ETH, BTC)"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="flex-1 rounded-lg border px-3 py-2"
					/>
					<Button onClick={() => setSearchTerm("")} variant="outline">
						Clear
					</Button>
				</div>

				{loadingSearch && searchTerm ? (
					<div className="space-y-2">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-16 w-full" />
						))}
					</div>
				) : (
					searchResults?.currencies &&
					searchResults.currencies.length > 0 && (
						<div className="space-y-2">
							<p className="mb-2 text-muted-foreground text-sm">
								{searchResults.message}
							</p>
							{searchResults.currencies.map((currency) => (
								<div
									key={`${currency.chainId}-${currency.address}`}
									className="flex items-center justify-between rounded-lg border p-3"
								>
									<div className="flex items-center gap-3">
										{currency.metadata.logoURI && (
											<img
												src={currency.metadata.logoURI}
												alt={currency.symbol}
												className="h-8 w-8 rounded-full"
											/>
										)}
										<div>
											<div className="font-medium">{currency.symbol}</div>
											<div className="text-muted-foreground text-sm">
												{currency.name}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="secondary">Chain {currency.chainId}</Badge>
										{currency.metadata.verified && (
											<Badge variant="default">Verified</Badge>
										)}
									</div>
								</div>
							))}
						</div>
					)
				)}
			</Card>

			{/* Address Lookup */}
			<Card className="p-4">
				<h3 className="mb-4 font-semibold text-lg">Lookup by Address</h3>
				<div className="mb-4 flex gap-2">
					<input
						type="text"
						placeholder="Enter token address (e.g., 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48)"
						value={addressLookup}
						onChange={(e) => setAddressLookup(e.target.value)}
						className="flex-1 rounded-lg border px-3 py-2 font-mono text-sm"
					/>
					<Button onClick={() => setAddressLookup("")} variant="outline">
						Clear
					</Button>
				</div>

				{loadingAddress && addressLookup ? (
					<Skeleton className="h-16 w-full" />
				) : (
					addressResult?.currency && (
						<div className="rounded-lg border p-3">
							<div className="mb-2 flex items-center gap-3">
								{addressResult.currency.metadata.logoURI && (
									<img
										src={addressResult.currency.metadata.logoURI}
										alt={addressResult.currency.symbol}
										className="h-10 w-10 rounded-full"
									/>
								)}
								<div>
									<div className="font-semibold text-lg">
										{addressResult.currency.symbol}
									</div>
									<div className="text-muted-foreground">
										{addressResult.currency.name}
									</div>
								</div>
							</div>
							<div className="space-y-1 text-sm">
								<p>
									<span className="font-medium">Address:</span>{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-xs">
										{addressResult.currency.address}
									</code>
								</p>
								<p>
									<span className="font-medium">Decimals:</span>{" "}
									{addressResult.currency.decimals}
								</p>
								<p>
									<span className="font-medium">Chain ID:</span>{" "}
									{addressResult.currency.chainId}
								</p>
								<div className="mt-2 flex items-center gap-2">
									{addressResult.currency.metadata.verified && (
										<Badge variant="default">Verified</Badge>
									)}
									{addressResult.currency.metadata.isNative && (
										<Badge variant="outline">Native</Badge>
									)}
								</div>
							</div>
						</div>
					)
				)}
			</Card>
		</div>
	);
}
