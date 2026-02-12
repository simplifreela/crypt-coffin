"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Balance, Wallet, Token, EVMNetwork } from "@/types";
import { TokenListItem } from "../TokenListItem";

interface AggregatedBalance extends Balance {
  wallet: Wallet;
}

interface OverviewByNetworkProps {
  allBalances: AggregatedBalance[];
  networks: EVMNetwork[];
  tokens: Token[];
}

export function OverviewByNetwork({
  allBalances,
  networks,
  tokens,
}: OverviewByNetworkProps) {
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
}
