"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Balance, Wallet, Token, EVMNetwork } from "@/types";
import { BalanceItem } from "../BalanceItem";

interface AggregatedBalance extends Balance {
  wallet: Wallet;
}

interface OverviewByTokenProps {
  allBalances: AggregatedBalance[];
  networks: EVMNetwork[];
  tokens: Token[];
}

export function OverviewByToken({
  allBalances,
  networks,
  tokens,
}: OverviewByTokenProps) {
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
}
