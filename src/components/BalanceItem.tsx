"use client";

import { Balance, Token, Wallet, EVMNetwork } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BalanceItemProps {
  balance: Balance;
  token: Token | undefined;
  wallet?: Wallet;
  network?: EVMNetwork;
}

/**
 * BalanceItem - Displays a single balance entry
 * Can be used in different contexts (by token, network, or wallet)
 */
export function BalanceItem({
  balance,
  token,
  wallet,
  network,
}: BalanceItemProps) {
  if (!token) return null;

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{token.symbol}</Badge>
            <span className="text-sm font-medium">{token.name}</span>
          </div>
          {wallet && (
            <p className="mt-1 text-xs text-muted-foreground">
              {wallet.name} ({wallet.address.slice(0, 6)}...)
            </p>
          )}
          {network && (
            <p className="mt-1 text-xs text-muted-foreground">{network.name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold">
            {parseFloat(balance.balance).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}{" "}
            {token.symbol}
          </p>
          <p className="text-sm text-muted-foreground">
            ${balance.balanceUSD}
          </p>
        </div>
      </div>
    </Card>
  );
}
