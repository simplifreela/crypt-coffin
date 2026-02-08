
"use client";
import { useWallets } from "@/hooks/useWallets";
import { TokenListItem } from "./TokenListItem";
import { Button } from "./ui/button";
import { Plus, Settings, RefreshCw } from "lucide-react";
import { useState } from "react";
import { AddTokenDialog } from "./dialogs/AddTokenDialog";
import { AddNetworkDialog } from "./dialogs/AddNetworkDialog";
import { Skeleton } from "./ui/skeleton";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Balance } from "@/types";

export default function TokenList() {
    const { activeWallet, balances, fetchBalances, networks, tokens } = useWallets();
    const [isAddTokenOpen, setIsAddTokenOpen] = useState(false);
    const [isAddNetworkOpen, setIsAddNetworkOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    if (!activeWallet) return null;

    const handleRefresh = async () => {
        if (!activeWallet) return;
        setIsRefreshing(true);
        await fetchBalances(activeWallet, true);
        setIsRefreshing(false);
    }

    const walletBalances = balances.get(activeWallet.id);
    const isFetching = walletBalances === undefined;

    const totalUsdBalance = walletBalances
        ? walletBalances.reduce((sum, current) => sum + parseFloat(current.balanceUSD), 0)
        : 0;

    const groupedBalances = walletBalances?.reduce((acc, balance) => {
        const token = tokens.find(t => t.id === balance.tokenId);
        if (!token) return acc;
        
        const { networkId } = token;
        if (!acc[networkId]) {
            acc[networkId] = [];
        }
        acc[networkId].push(balance);
        return acc;
    }, {} as Record<string, Balance[]>);

    const networkOrder = networks.map(n => n.id);
    const defaultOrder = ['btc', ...networkOrder.filter(id => id !== 'btc')];
    
    const sortedNetworkIds = groupedBalances ? Object.keys(groupedBalances).sort((a, b) => {
        const indexA = defaultOrder.indexOf(a);
        const indexB = defaultOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    }) : [];

    const renderBalances = () => {
        if (isFetching || isRefreshing) {
            return (
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
        }

        if (groupedBalances && sortedNetworkIds.length > 0) {
            return (
                <Accordion type="multiple" className="w-full" defaultValue={sortedNetworkIds}>
                    {sortedNetworkIds.map(networkId => {
                        const network = networks.find(n => n.id === networkId);
                        const networkName = network ? network.name : (networkId === 'btc' ? 'Bitcoin' : networkId === 'near' ? 'Near' : networkId === 'solana' ? 'Solana' : networkId);
                        const balancesForNetwork = groupedBalances[networkId];
                        const networkTotalUsd = balancesForNetwork.reduce((sum, b) => sum + parseFloat(b.balanceUSD), 0);

                        return (
                            <AccordionItem value={networkId} key={networkId}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4 items-center">
                                        <span className="font-semibold text-lg">{networkName}</span>
                                        <span className="font-semibold text-muted-foreground">${networkTotalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pl-2">
                                    <div className="space-y-2">
                                    {balancesForNetwork.map(balance => (
                                        <TokenListItem key={balance.id} balance={balance} />
                                    ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                </Accordion>
            )
        }

        return (
             <div className="text-center py-20 rounded-lg bg-secondary">
                <h3 className="text-lg font-semibold">No balances to show</h3>
                <p className="text-muted-foreground">This wallet has no tracked tokens or they have a zero balance.</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-start mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold">{activeWallet.name}</h2>
                    <p className="text-muted-foreground">Asset Balances</p>
                    {(isFetching || isRefreshing) ? (
                        <Skeleton className="h-9 w-48 mt-2" />
                    ) : (
                        <h4 className="text-3xl font-bold mt-2">
                            ${totalUsdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} />
                        {isRefreshing ? "Refreshing..." : "Refresh"}
                    </Button>

                    {(activeWallet.type === 'evm' || activeWallet.type === 'near' || activeWallet.type === 'solana') && (
                        <Button variant="outline" onClick={() => setIsAddTokenOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Token
                        </Button>
                    )}
                    {activeWallet.type === 'evm' && (
                        <Button variant="outline" onClick={() => setIsAddNetworkOpen(true)}>
                            <Settings className="mr-2 h-4 w-4" /> Manage Networks
                        </Button>
                    )}
                </div>
            </div>
            
            <ScrollArea className="flex-grow pr-4">
                {renderBalances()}
            </ScrollArea>

            <AddTokenDialog open={isAddTokenOpen} onOpenChange={setIsAddTokenOpen} />
            <AddNetworkDialog open={isAddNetworkOpen} onOpenChange={setIsAddNetworkOpen} />
        </div>
    )
}

    