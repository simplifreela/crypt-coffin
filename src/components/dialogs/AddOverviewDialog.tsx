"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/hooks/use-toast";
import type { Wallet } from "@/types";

export function AddOverviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { wallets, addPortfolioOverview } = useWallets() as any;
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const init: Record<string, boolean> = {};
    wallets.forEach((w: Wallet) => (init[w.id] = false));
    setSelected(init);
  }, [wallets]);

  const handleToggle = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast({ title: "Error", description: "Please enter a name.", variant: "destructive" });
      return;
    }
    const walletIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    try {
      await addPortfolioOverview({ name: name.trim(), description: description.trim(), walletIds });
      toast({ title: "Success", description: "Overview created." });
      onOpenChange(false);
      setName(""); setDescription("");
    } catch (e) {
      toast({ title: "Error", description: "Failed to create overview.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Portfolio Overview</DialogTitle>
          <DialogDescription>Create a named group of wallets to view together.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="ov-name" className="text-right">Name</Label>
            <Input id="ov-name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="ov-desc" className="text-right">Description</Label>
            <Input id="ov-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Select wallets</p>
            <div className="grid gap-2">
              {wallets.map((w: Wallet) => (
                <label key={w.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selected[w.id]} onChange={() => handleToggle(w.id)} />
                  <span className="text-sm">{w.name} ({w.address.slice(0,6)}...)</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAdd}>Create Overview</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
