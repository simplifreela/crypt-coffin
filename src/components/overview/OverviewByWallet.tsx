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

interface OverviewByWalletProps {
  allBalances: AggregatedBalance[];
  networks: EVMNetwork[];
  tokens: Token[];
  wallets: Wallet[];
}

export function OverviewByWallet({
  allBalances,
  networks,
  tokens,
  wallets,
}: OverviewByWalletProps) {
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
