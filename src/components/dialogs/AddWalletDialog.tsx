"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useWallets } from "@/hooks/useWallets";
import { WalletType } from "@/types";
import { useToast } from "@/hooks/use-toast";

export function AddWalletDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { connectEvmWallet, addWatchedWallet } = useWallets();
  const { toast } = useToast();
  const [watchedAddress, setWatchedAddress] = useState("");
  const [watchedType, setWatchedType] = useState<WalletType>("evm");
  const [watchedName, setWatchedName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleAddWatched = async () => {
    if (!watchedAddress || !watchedName) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }
    try {
      await addWatchedWallet(watchedAddress, watchedType, watchedName);
      toast({
        title: "Success",
        description: "Watched wallet added.",
      });
      onOpenChange(false);
      setWatchedAddress("");
      setWatchedName("");
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error",
        description: `Failed to add wallet. ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const handleConnectEvm = async () => {
    setIsConnecting(true);
    try {
        await connectEvmWallet();
        onOpenChange(false);
    } catch (e) {
        // Error toast is handled in context
    } finally {
        setIsConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Wallet</DialogTitle>
          <DialogDescription>
            Connect a wallet or add an address to watch.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="connect" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="connect">Connect Wallet</TabsTrigger>
            <TabsTrigger value="watch">Watch Address</TabsTrigger>
          </TabsList>
          <TabsContent value="connect" className="space-y-4 pt-4">
            <Button className="w-full" onClick={handleConnectEvm} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect MetaMask"}
            </Button>
            <Button className="w-full" variant="secondary" disabled>Connect Near Wallet (soon)</Button>
            <Button className="w-full" variant="secondary" disabled>Connect Solana Wallet (soon)</Button>
          </TabsContent>
          <TabsContent value="watch" className="space-y-4 pt-4">
            <div className="space-y-2">
                <Label htmlFor="name">Wallet Name</Label>
                <Input id="name" value={watchedName} onChange={(e) => setWatchedName(e.target.value)} placeholder="e.g. My Savings" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={watchedAddress} onChange={(e) => setWatchedAddress(e.target.value)} placeholder="0x..." />
            </div>
            <div className="space-y-2">
                <Label htmlFor="type">Wallet Type</Label>
                <Select value={watchedType} onValueChange={(v) => setWatchedType(v as WalletType)}>
                    <SelectTrigger id="type">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="evm">EVM</SelectItem>
                        <SelectItem value="solana">Solana</SelectItem>
                        <SelectItem value="btc">Bitcoin</SelectItem>
                        <SelectItem value="near">Near</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button className="w-full" onClick={handleAddWatched}>Add Watched Wallet</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
