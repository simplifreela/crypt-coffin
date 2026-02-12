
"use client";
import { useWallets } from "@/hooks/useWallets";
import { TokenListItem } from "./TokenListItem";
import { BalanceItem } from "./BalanceItem";
import { Skeleton } from "./ui/skeleton";
import { ScrollArea } from "./ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Balance, Wallet, Token } from "@/types";
import { useState } from "react";

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

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <div className="pl-6 space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <div className="pl-6 space-y-2">
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </div>
  );

  const renderByNetwork = () => {
    const groupedBalances = allBalances.reduce(
      (acc, balance) => {
        const token = tokens.find((t) => t.id === balance.tokenId);
        if (!token) return acc;

        const { networkId } = token;
        if (!acc[networkId]) {
          acc[networkId] = [];
        }
        acc[networkId].push(balance);
        return acc;
      },
      {} as Record<string, AggregatedBalance[]>,
    );

    const networkOrder = networks.map((n) => n.id);
    const defaultOrder = ["btc", ...networkOrder.filter((id) => id !== "btc")];

    const sortedNetworkIds = Object.keys(groupedBalances).sort((a, b) => {
      const indexA = defaultOrder.indexOf(a);
      const indexB = defaultOrder.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    return (
      <Accordion
        type="multiple"
        className="w-full"
        defaultValue={sortedNetworkIds}
      >
        {sortedNetworkIds.map((networkId) => {
          const network = networks.find((n) => n.id === networkId);
          const networkName = network
            ? network.name
            : networkId === "btc"
              ? "Bitcoin"
              : networkId;
          const balancesForNetwork = groupedBalances[networkId];
          const networkTotalUsd = balancesForNetwork.reduce(
            (sum, b) => sum + parseFloat(b.balanceUSD),
            0,
          );

          return (
            <AccordionItem value={networkId} key={networkId}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4 items-center">
                  <span className="font-semibold text-lg">{networkName}</span>
                  <span className="font-semibold text-muted-foreground">
                    ${networkTotalUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-2">
                <div className="space-y-2">
                  {balancesForNetwork.map((balance) => (
                    <TokenListItem
                      key={balance.id}
                      balance={balance}
                      wallet={balance.wallet}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const renderByToken = () => {
    const groupedBalances = allBalances.reduce(
      (acc, balance) => {
        if (!acc[balance.tokenId]) {
          acc[balance.tokenId] = [];
        }
        acc[balance.tokenId].push(balance);
        return acc;
      },
      {} as Record<string, AggregatedBalance[]>,
    );

    const tokenIds = Object.keys(groupedBalances).sort();

    return (
      <Accordion type="multiple" className="w-full" defaultValue={tokenIds}>
        {tokenIds.map((tokenId) => {
          const token = tokens.find((t) => t.id === tokenId);
          if (!token) return null;

          const balancesForToken = groupedBalances[tokenId];
          const tokenTotalUsd = balancesForToken.reduce(
            (sum, b) => sum + parseFloat(b.balanceUSD),
            0,
          );

          // Group by network
          const byNetwork = balancesForToken.reduce(
            (acc, balance) => {
              const net = networks.find(
                (n) => n.id === token.networkId,
              );
              const netId = token.networkId;
              if (!acc[netId]) {
                acc[netId] = [];
              }
              acc[netId].push(balance);
              return acc;
            },
            {} as Record<string, AggregatedBalance[]>,
          );

          return (
            <AccordionItem value={tokenId} key={tokenId}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4 items-center">
                  <span className="font-semibold text-lg">{token.name}</span>
                  <span className="font-semibold text-muted-foreground">
                    ${tokenTotalUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-2">
                <div className="space-y-4">
                  {Object.entries(byNetwork).map(([netId, balancesList]) => {
                    const network = networks.find((n) => n.id === netId);
                    const netName = network ? network.name : netId;
                    const netTotal = balancesList.reduce(
                      (sum, b) => sum + parseFloat(b.balanceUSD),
                      0,
                    );

                    return (
                      <div key={netId}>
                        <p className="text-sm font-medium mb-2">
                          {netName} - ${netTotal.toFixed(2)}
                        </p>
                        <div className="space-y-2 pl-4">
                          {balancesList.map((balance) => (
                            <BalanceItem
                              key={balance.id}
                              balance={balance}
                              token={token}
                              wallet={balance.wallet}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const renderByWallet = () => {
    const groupedBalances = allBalances.reduce(
      (acc, balance) => {
        if (!acc[balance.walletId]) {
          acc[balance.walletId] = [];
        }
        acc[balance.walletId].push(balance);
        return acc;
      },
      {} as Record<string, AggregatedBalance[]>,
    );

    const walletIds = Object.keys(groupedBalances).sort();

    return (
      <Accordion type="multiple" className="w-full" defaultValue={walletIds}>
        {walletIds.map((walletId) => {
          const wallet = wallets.find((w) => w.id === walletId);
          if (!wallet) return null;

          const balancesForWallet = groupedBalances[walletId];
          const walletTotalUsd = balancesForWallet.reduce(
            (sum, b) => sum + parseFloat(b.balanceUSD),
            0,
          );

          // Group by network
          const byNetwork = balancesForWallet.reduce(
            (acc, balance) => {
              const token = tokens.find((t) => t.id === balance.tokenId);
              if (!token) return acc;
              const netId = token.networkId;
              if (!acc[netId]) {
                acc[netId] = [];
              }
              acc[netId].push(balance);
              return acc;
            },
            {} as Record<string, AggregatedBalance[]>,
          );

          return (
            <AccordionItem value={walletId} key={walletId}>
              <AccordionTrigger>
                <div className="flex justify-between w-full pr-4 items-center">
                  <span className="font-semibold text-lg">{wallet.name}</span>
                  <span className="font-semibold text-muted-foreground">
                    ${walletTotalUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pl-2">
                <div className="space-y-4">
                  {Object.entries(byNetwork).map(([netId, balancesList]) => {
                    const network = networks.find((n) => n.id === netId);
                    const netName = network ? network.name : netId;
                    const netTotal = balancesList.reduce(
                      (sum, b) => sum + parseFloat(b.balanceUSD),
                      0,
                    );

                    return (
                      <div key={netId}>
                        <p className="text-sm font-medium mb-2">
                          {netName} - ${netTotal.toFixed(2)}
                        </p>
                        <div className="space-y-2 pl-4">
                          {balancesList.map((balance) => (
                            <BalanceItem
                              key={balance.id}
                              balance={balance}
                              token={tokens.find(
                                (t) => t.id === balance.tokenId,
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return renderLoadingSkeleton();
    }

    if (allBalances.length === 0) {
      return (
        <div className="text-center py-20 rounded-lg bg-secondary">
          <h3 className="text-lg font-semibold">No balances to show</h3>
          <p className="text-muted-foreground">
            This portfolio has no tracked tokens or they have a zero balance.
          </p>
        </div>
      );
    }

    switch (viewMode) {
      case "token":
        return renderByToken();
      case "wallet":
        return renderByWallet();
      case "network":
      default:
        return renderByNetwork();
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
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
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

    