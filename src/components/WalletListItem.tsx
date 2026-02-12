
"use client";
import { Wallet } from "@/types";
import { Button } from "./ui/button";
import { CryptoIcon } from "./icons/CryptoIcons";
import { cn } from "@/lib/utils";
import { Copy, Eye, Wallet as WalletIcon, X, Settings } from "lucide-react";
import { useState } from "react";
import { RenameWalletDialog } from "@/components/dialogs/RenameWalletDialog";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/hooks/use-toast";
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

export function WalletListItem({ wallet, isActive, onClick }: { wallet: Wallet, isActive: boolean, onClick: () => void }) {
    const { removeWallet } = useWallets();
    const { toast } = useToast();
    const [isRenameOpen, setIsRenameOpen] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(wallet.address);
        toast({ title: "Copied!", description: "Wallet address copied to clipboard." });
    }

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        removeWallet(wallet.id);
        toast({ title: "Wallet removed", description: `${wallet.name} has been removed.`})
    }

    const truncateAddress = (address: string) => {
        if (address.length <= 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    return (
        <div 
            onClick={onClick} 
            className={cn(
                "group relative block p-3 rounded-lg cursor-pointer border-2 transition-all",
                isActive ? "bg-primary/10 border-primary" : "border-transparent hover:bg-secondary"
            )}>
            <div className="flex items-center gap-3 pr-20">
                <div className="bg-background/50 p-3 rounded-full">
                    <CryptoIcon symbol={wallet.address} className="w-6 h-6" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{wallet.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{truncateAddress(wallet.address)}</p>
                </div>
                <div>
                {wallet.isWatched ? (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                ) : (
                    <WalletIcon className="w-4 h-4 text-muted-foreground" />
                )}
                </div>
            </div>
             <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={handleCopy}>
                    <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="w-7 h-7" onClick={(e) => { e.stopPropagation(); setIsRenameOpen(true); }}>
                    <Settings className="w-4 h-4" />
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-destructive/20 hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                            <X className="w-4 h-4" />
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the wallet "{wallet.name}" from your list.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
            <RenameWalletDialog open={isRenameOpen} onOpenChange={setIsRenameOpen} wallet={wallet} />
        </div>
    )
}
