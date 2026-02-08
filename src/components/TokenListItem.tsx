
"use client";

import { Balance, Wallet, Token } from "@/types";
import { Card } from "./ui/card";
import { CryptoIcon } from "./icons/CryptoIcons";
import { useWallets } from "@/hooks/useWallets";
import { Button } from "./ui/button";
import { RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast";

export function TokenListItem({ balance, wallet }: { balance: Balance, wallet?: Wallet }) {
  const { activeWallet, fetchBalanceForToken, removeCustomToken, tokens } = useWallets();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();
  
  const token = tokens.find(t => t.id === balance.tokenId);
  
  const walletForRefresh = wallet || activeWallet;
  
  if (!token) {
      // This can happen briefly during a refresh
      return null; 
  }

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletForRefresh || !fetchBalanceForToken) return;
    setIsRefreshing(true);
    await fetchBalanceForToken(walletForRefresh, token);
    setIsRefreshing(false);
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token.isCustom || !removeCustomToken) return;
    removeCustomToken(token.id);
    toast({ title: "Token removed", description: `${token.name} has been removed.` });
  }

  const truncateAddress = (address: string) => {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  return (
    <Card className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
      <div className="flex items-center gap-4">
        <CryptoIcon symbol={token.symbol} className="w-10 h-10" />
        <div>
          <p className="font-semibold">{token.name}</p>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{token.symbol}</p>
            {wallet && <p className="text-xs text-muted-foreground/70 font-mono bg-muted px-1.5 py-0.5 rounded">{truncateAddress(wallet.address)}</p>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="font-semibold text-lg">{balance.balance}</p>
          <p className="text-sm text-muted-foreground">${balance.balanceUSD}</p>
        </div>
        <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
        {token.isCustom && (
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full hover:bg-destructive/20 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                        <X className="w-4 h-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove the token "{token.name}" from your tracked list.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemove}>Continue</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      </div>
    </Card>
  );
}

    