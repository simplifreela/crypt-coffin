"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/hooks/use-toast";

export function AddNetworkDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { addCustomNetwork } = useWallets();
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [rpcUrl, setRpcUrl] = useState("");
    const [chainId, setChainId] = useState("");
    const [symbol, setSymbol] = useState("");

    const handleAdd = async () => {
        if (!name || !rpcUrl || !chainId || !symbol) {
            toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
            return;
        }
        const chainIdNum = parseInt(chainId);
        if (isNaN(chainIdNum)) {
            toast({ title: "Error", description: "Chain ID must be a number.", variant: "destructive" });
            return;
        }

        try {
            await addCustomNetwork({ name, rpcUrl, chainId: chainIdNum, symbol });
            toast({ title: "Success", description: "Network added." });
            onOpenChange(false);
            setName(""); setRpcUrl(""); setChainId(""); setSymbol("");
        } catch (e) {
            toast({ title: "Error", description: "Failed to add network.", variant: "destructive" });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Custom Network</DialogTitle>
                    <DialogDescription>Add a custom EVM-compatible network.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="net-name" className="text-right">Name</Label>
                        <Input id="net-name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g. My Testnet" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="net-rpc" className="text-right">RPC URL</Label>
                        <Input id="net-rpc" value={rpcUrl} onChange={e => setRpcUrl(e.target.value)} className="col-span-3" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="net-chainid" className="text-right">Chain ID</Label>
                        <Input id="net-chainid" value={chainId} onChange={e => setChainId(e.target.value)} className="col-span-3" placeholder="e.g. 12345" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="net-symbol" className="text-right">Symbol</Label>
                        <Input id="net-symbol" value={symbol} onChange={e => setSymbol(e.target.value)} className="col-span-3" placeholder="e.g. TST" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleAdd}>Add Network</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
