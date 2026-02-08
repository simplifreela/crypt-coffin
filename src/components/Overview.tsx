
"use client";
import { useWallets } from "@/hooks/useWallets";
import { TokenListItem } from "./TokenListItem";
import { Skeleton } from "./ui/skeleton";
import { ScrollArea } from "./ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Balance, Wallet } from "@/types";

interface AggregatedBalance extends Balance {
    wallet: Wallet;
}

export default function Overview() {
    const { wallets, balances, networks, loading: isLoadingWallets, tokens } = useWallets();

    const allBalances: AggregatedBalance[] = [];
    let isFetchingBalances = false;
    if (isLoadingWallets) {
        isFetchingBalances = true;
    } else {
        wallets.forEach(wallet => {
            const walletBalances = balances.get(wallet.id);
            if (walletBalances === undefined && wallets.length > 0) {
                isFetchingBalances = true;
            }
            walletBalances?.forEach(balance => {
                allBalances.push({ ...balance, wallet });
            });
        });
    }

    const totalPortfolioValue = allBalances.reduce((sum, current) => sum + parseFloat(current.balanceUSD), 0);
    
    const groupedBalances = allBalances.reduce((acc, balance) => {
        const token = tokens.find(t => t.id === balance.tokenId);
        if (!token) return acc;

        const { networkId } = token;
        if (!acc[networkId]) {
            acc[networkId] = [];
        }
        acc[networkId].push(balance);
        return acc;
    }, {} as Record<string, AggregatedBalance[]>);

    const networkOrder = networks.map(n => n.id);
    const defaultOrder = ['btc', ...networkOrder.filter(id => id !== 'btc')];
    
    const sortedNetworkIds = Object.keys(groupedBalances).sort((a, b) => {
        const indexA = defaultOrder.indexOf(a);
        const indexB = defaultOrder.indexOf(b);
        if (indexA === -1 && indexB === -1) return a.localeCompare(b);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });

    const isLoading = isLoadingWallets || isFetchingBalances;

    const renderBalances = () => {
        if (isLoading) {
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
                        const networkName = network ? network.name : (networkId === 'btc' ? 'Bitcoin' : networkId);
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
                                        <TokenListItem key={balance.id} balance={balance} wallet={balance.wallet} />
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
                <p className="text-muted-foreground">This portfolio has no tracked tokens or they have a zero balance.</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-start mb-6 flex-shrink-0">
                <div>
                    <h2 className="text-2xl font-bold">Portfolio Overview</h2>
                    <p className="text-muted-foreground">Total Portfolio Value</p>
                    {isLoading ? (
                        <Skeleton className="h-9 w-48 mt-2" />
                    ) : (
                        <h4 className="text-3xl font-bold mt-2">
                            ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </h4>
                    )}
                </div>
            </div>
            
            <ScrollArea className="flex-grow pr-4">
                {renderBalances()}
            </ScrollArea>
        </div>
    );
}

    