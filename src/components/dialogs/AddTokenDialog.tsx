"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/hooks/use-toast";

export function AddTokenDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
    const { networks, addCustomToken, activeWallet } = useWallets();
    const { toast } = useToast();
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [symbol, setSymbol] = useState("");
    const [networkId, setNetworkId] = useState("");

    const isNear = activeWallet?.type === 'near';
    const isSolana = activeWallet?.type === 'solana';
    
    useEffect(() => {
        if (open) {
            setName("");
            setAddress("");
            setSymbol("");
            if (isNear) {
                setNetworkId('near');
            } else if (isSolana) {
                setNetworkId('solana');
            } else {
                setNetworkId('');
            }
        }
    }, [open, isNear, isSolana]);
    
    const evmNetworks = networks.filter(n => n.id);

    const handleAdd = async () => {
        if (!name || !address || !symbol || !networkId) {
            toast({ title: "Error", description: "Please fill all fields.", variant: "destructive" });
            return;
        }

        try {
            await addCustomToken({ name, address, symbol, networkId });
            toast({ title: "Success", description: "Token added." });
            onOpenChange(false);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to add token.";
            toast({ title: "Error", description: message, variant: "destructive" });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add Custom Token</DialogTitle>
                    <DialogDescription>
                        {isNear ? "Add a NEP-141 token to track on NEAR." : isSolana ? "Add a SPL token to track on Solana." : "Add an ERC20 token to track."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="token-net" className="text-right">Network</Label>
                        {isNear ? (
                             <Input id="token-net" value="Near" readOnly className="col-span-3" />
                        ) : isSolana ? (
                            <Input id="token-net" value="Solana" readOnly className="col-span-3" />
                        ) : (
                            <Select value={networkId} onValueChange={setNetworkId}>
                                <SelectTrigger className="col-span-3" id="token-net">
                                    <SelectValue placeholder="Select network" />
                                </SelectTrigger>
                                <SelectContent>
                                    {evmNetworks.map(net => (
                                        <SelectItem key={net.id} value={net.id}>{net.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="token-address" className="text-right">
                            {isNear ? 'Account ID' : isSolana ? 'Mint Address' : 'Address'}
                        </Label>
                        <Input id="token-address" value={address} onChange={e => setAddress(e.target.value)} className="col-span-3" placeholder={isNear ? "e.g. meta-pool.near" : isSolana ? "e.g. Es9vMFrzaCE..." : "0x..."} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="token-name" className="text-right">Name</Label>
                        <Input id="token-name" value={name} onChange={e => setName(e.target.value)} className="col-span-3" placeholder="e.g. My Token" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="token-symbol" className="text-right">Symbol</Label>
                        <Input id="token-symbol" value={symbol} onChange={e => setSymbol(e.target.value)} className="col-span-3" placeholder="e.g. MYT" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleAdd}>Add Token</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
