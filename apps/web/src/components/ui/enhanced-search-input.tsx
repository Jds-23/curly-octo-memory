/**
 * Enhanced Search Input Component - TokenSelectorV2 UI
 *
 * Advanced search input with fuzzy matching, suggestions, history, and filtering capabilities
 */

import { ChevronDown, Clock, Filter, Search, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
	SearchHistoryItem,
	SearchSuggestion,
} from "@/lib/search/enhanced-search";
import { EnhancedSearchEngine } from "@/lib/search/enhanced-search";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";

export interface EnhancedSearchInputProps {
	value: string;
	onChange: (value: string) => void;
	onSearchSubmit?: (query: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	showFilters?: boolean;
	showHistory?: boolean;
	showSuggestions?: boolean;
	autoFocus?: boolean;
}

export function EnhancedSearchInput({
	value,
	onChange,
	onSearchSubmit,
	placeholder = "Search tokens by name, symbol, or address...",
	disabled = false,
	className,
	showFilters = true,
	showHistory = true,
	showSuggestions = true,
	autoFocus = false,
}: EnhancedSearchInputProps) {
	const [isFocused, setIsFocused] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
	const [history, setHistory] = useState<SearchHistoryItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	// Load search history on mount
	useEffect(() => {
		if (showHistory) {
			const searchHistory = EnhancedSearchEngine.getSearchHistory();
			setHistory(searchHistory);
		}
	}, [showHistory]);

	// Handle input focus
	const handleFocus = useCallback(() => {
		setIsFocused(true);
		setShowDropdown(true);
	}, []);

	// Handle input blur with delay to allow for click events
	const handleBlur = useCallback(() => {
		setTimeout(() => {
			setIsFocused(false);
			setShowDropdown(false);
		}, 150);
	}, []);

	// Handle input value change
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = e.target.value;
			onChange(newValue);

			// Generate suggestions for non-empty queries
			if (newValue.trim() && showSuggestions) {
				setIsLoading(true);
				// Simulate async suggestion generation
				setTimeout(() => {
					const newSuggestions =
						EnhancedSearchEngine.generateSuggestions(newValue);
					setSuggestions(newSuggestions);
					setIsLoading(false);
				}, 100);
			} else {
				setSuggestions([]);
			}
		},
		[onChange, showSuggestions],
	);

	// Handle search submission
	const handleSubmit = useCallback(
		(query: string = value) => {
			if (query.trim()) {
				EnhancedSearchEngine.addToSearchHistory(query.trim());
				onSearchSubmit?.(query.trim());
				setShowDropdown(false);
				inputRef.current?.blur();
			}
		},
		[value, onSearchSubmit],
	);

	// Handle suggestion click
	const handleSuggestionClick = useCallback(
		(suggestion: SearchSuggestion) => {
			onChange(suggestion.text);
			handleSubmit(suggestion.text);
		},
		[onChange, handleSubmit],
	);

	// Handle history item click
	const handleHistoryClick = useCallback(
		(historyItem: SearchHistoryItem) => {
			onChange(historyItem.query);
			handleSubmit(historyItem.query);
		},
		[onChange, handleSubmit],
	);

	// Clear input
	const handleClear = useCallback(() => {
		onChange("");
		inputRef.current?.focus();
	}, [onChange]);

	// Clear search history
	const handleClearHistory = useCallback(() => {
		EnhancedSearchEngine.clearSearchHistory();
		setHistory([]);
	}, []);

	// Handle key down events
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			} else if (e.key === "Escape") {
				setShowDropdown(false);
				inputRef.current?.blur();
			}
		},
		[handleSubmit],
	);

	// Click outside to close dropdown
	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node) &&
				inputRef.current &&
				!inputRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const hasContent =
		suggestions.length > 0 || (history.length > 0 && showHistory);

	return (
		<div className={cn("relative w-full", className)}>
			{/* Search Input */}
			<div className="relative">
				<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
				<Input
					ref={inputRef}
					type="text"
					value={value}
					onChange={handleInputChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					autoFocus={autoFocus}
					className={cn(
						"pr-20 pl-9",
						isFocused && "ring-2 ring-ring ring-offset-2",
					)}
				/>

				{/* Clear Button */}
				{value && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleClear}
						className="-translate-y-1/2 absolute top-1/2 right-12 h-6 w-6 p-0 hover:bg-muted"
					>
						<X className="h-3 w-3" />
					</Button>
				)}

				{/* Filters Button */}
				{showFilters && (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-translate-y-1/2 absolute top-1/2 right-2 h-6 w-6 p-0 hover:bg-muted"
					>
						<Filter className="h-3 w-3" />
					</Button>
				)}
			</div>

			{/* Dropdown */}
			{showDropdown && hasContent && (
				<Card
					ref={dropdownRef}
					className="absolute top-full z-50 mt-1 max-h-80 w-full overflow-hidden border bg-background shadow-lg"
				>
					<div className="max-h-80 overflow-y-auto">
						{/* Loading State */}
						{isLoading && (
							<div className="flex items-center justify-center p-4">
								<div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
								<span className="ml-2 text-muted-foreground text-sm">
									Searching...
								</span>
							</div>
						)}

						{/* Suggestions */}
						{!isLoading && suggestions.length > 0 && (
							<div>
								<div className="px-3 py-2 font-medium text-muted-foreground text-xs">
									Suggestions
								</div>
								{suggestions.map((suggestion, index) => (
									<button
										key={`suggestion-${index}`}
										type="button"
										onClick={() => handleSuggestionClick(suggestion)}
										className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
									>
										<Search className="h-3 w-3 text-muted-foreground" />
										<span className="flex-1 text-sm">{suggestion.text}</span>
										{suggestion.category && (
											<Badge variant="secondary" className="text-xs">
												{suggestion.category}
											</Badge>
										)}
									</button>
								))}
							</div>
						)}

						{/* Search History */}
						{!isLoading && showHistory && history.length > 0 && (
							<div>
								{suggestions.length > 0 && <div className="border-t" />}
								<div className="flex items-center justify-between px-3 py-2">
									<span className="font-medium text-muted-foreground text-xs">
										Recent searches
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleClearHistory}
										className="h-auto p-0 text-muted-foreground text-xs hover:text-foreground"
									>
										Clear
									</Button>
								</div>
								{history.slice(0, 5).map((item, index) => (
									<button
										key={`history-${index}`}
										type="button"
										onClick={() => handleHistoryClick(item)}
										className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
									>
										<Clock className="h-3 w-3 text-muted-foreground" />
										<span className="flex-1 text-sm">{item.query}</span>
										<span className="text-muted-foreground text-xs">
											{new Date(item.timestamp).toLocaleDateString()}
										</span>
									</button>
								))}
							</div>
						)}

						{/* Empty State */}
						{!isLoading && suggestions.length === 0 && history.length === 0 && (
							<div className="flex items-center justify-center p-4">
								<span className="text-muted-foreground text-sm">
									No suggestions available
								</span>
							</div>
						)}
					</div>
				</Card>
			)}
		</div>
	);
}
