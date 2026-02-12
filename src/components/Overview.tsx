
"use client";
import { useWallets } from "@/hooks/useWallets";
import { Skeleton } from "./ui/skeleton";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Balance, Wallet, Token } from "@/types";
import { useState } from "react";
import { OverviewByNetwork } from "./overview/OverviewByNetwork";
import { OverviewByToken } from "./overview/OverviewByToken";
import { OverviewByWallet } from "./overview/OverviewByWallet";
import { OverviewLoadingSkeleton } from "./overview/OverviewLoadingSkeleton";
import { OverviewEmptyState } from "./overview/OverviewEmptyState";

type ViewMode = "network" | "token" | "wallet";

interface AggregatedBalance extends Balance {
  wallet: Wallet;
}

export default function Overview() {
  const { wallets, balances, networks, loading: isLoadingWallets, tokens } =
    useWallets();
  const [viewMode, setViewMode] = useState<ViewMode>("network");

  const allBalances: AggregatedBalance[] = [];
  let isFetchingBalances = false;

  if (isLoadingWallets) {
    isFetchingBalances = true;
  } else {
    wallets.forEach((wallet) => {
      const walletBalances = balances.get(wallet.id);
      if (walletBalances === undefined && wallets.length > 0) {
        isFetchingBalances = true;
      }
      walletBalances?.forEach((balance) => {
        allBalances.push({ ...balance, wallet });
      });
    });
  }

  const totalPortfolioValue = allBalances.reduce(
    (sum, current) => sum + parseFloat(current.balanceUSD),
    0,
  );

  const isLoading = isLoadingWallets || isFetchingBalances;

  const renderContent = () => {
    if (isLoading) {
      return <OverviewLoadingSkeleton />;
    }

    if (allBalances.length === 0) {
      return <OverviewEmptyState />;
    }

    switch (viewMode) {
      case "token":
        return (
          <OverviewByToken
            allBalances={allBalances}
            networks={networks}
            tokens={tokens}
          />
        );
      case "wallet":
        return (
          <OverviewByWallet
            allBalances={allBalances}
            networks={networks}
            tokens={tokens}
            wallets={wallets}
          />
        );
      case "network":
      default:
        return (
          <OverviewByNetwork
            allBalances={allBalances}
            networks={networks}
            tokens={tokens}
          />
        );
    }
  };


  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-start mb-6 flex-shrink-0 gap-4">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Overview</h2>
          <p className="text-muted-foreground">Total Portfolio Value</p>
          {isLoading ? (
            <Skeleton className="h-9 w-48 mt-2" />
          ) : (
            <h4 className="text-3xl font-bold mt-2">
              $
              {totalPortfolioValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </h4>
          )}
        </div>

        <div className="w-48">
          <label className="text-sm font-medium mb-2 block">View by:</label>
          <Select
            value={viewMode}
            onValueChange={(value) => setViewMode(value as ViewMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="network">Network</SelectItem>
              <SelectItem value="token">Token</SelectItem>
              <SelectItem value="wallet">Wallet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-grow pr-4">
        {renderContent()}
      </ScrollArea>
    </div>
  );
}