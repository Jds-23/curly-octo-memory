import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
	icon?: ReactNode;
	title: string;
	description: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	children?: ReactNode;
}

export function EmptyState({
	icon,
	title,
	description,
	action,
	children,
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
			{icon && <div className="text-muted-foreground">{icon}</div>}
			<div className="space-y-2">
				<h3 className="font-semibold text-lg">{title}</h3>
				<p className="max-w-md text-muted-foreground">{description}</p>
			</div>
			{action && (
				<Button onClick={action.onClick} className="mt-4">
					{action.label}
				</Button>
			)}
			{children}
		</div>
	);
}
