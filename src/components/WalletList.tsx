"use client";
import { useWallets } from "@/hooks/useWallets";
import { WalletListItem } from "./WalletListItem";
import { ScrollArea } from "./ui/scroll-area";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WalletList({ activeView, onViewChange }: { activeView: 'overview' | string; onViewChange: (view: 'overview' | string) => void }) {
    const { wallets } = useWallets();

    return (
        <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
                <div 
                    onClick={() => onViewChange('overview')} 
                    className={cn(
                        "group relative block p-3 rounded-lg cursor-pointer border-2 transition-all",
                        activeView === 'overview' ? "bg-primary/10 border-primary" : "border-transparent hover:bg-secondary"
                    )}>
                    <div className="flex items-center gap-3">
                        <div className="bg-background/50 p-3 rounded-full">
                            <LayoutDashboard className="w-6 h-6" />
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold truncate">Portfolio Overview</p>
                            <p className="text-xs text-muted-foreground truncate">All wallets aggregated</p>
                        </div>
                    </div>
                </div>

                <h2 className="text-lg font-semibold px-2 mb-2 pt-4">Wallets</h2>
                {wallets.map(wallet => (
                    <WalletListItem 
                        key={wallet.id}
                        wallet={wallet}
                        isActive={activeView === wallet.id}
                        onClick={() => onViewChange(wallet.id)}
                    />
                ))}
            </div>
        </ScrollArea>
    )
}
