"use client";
import { Balance, Wallet } from "@/types";

interface OverviewEmptyStateProps {
  message?: string;
  description?: string;
}

export function OverviewEmptyState({
  message = "No balances to show",
  description = "This portfolio has no tracked tokens or they have a zero balance.",
}: OverviewEmptyStateProps) {
  return (
    <div className="text-center py-20 rounded-lg bg-secondary">
      <h3 className="text-lg font-semibold">{message}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
