"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useWallets } from "@/hooks/useWallets";
import { useToast } from "@/hooks/use-toast";
import type { Wallet } from "@/types";

interface RenameWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallet: Wallet | null;
}

/**
 * RenameWalletDialog - Allows users to edit wallet names
 */
export function RenameWalletDialog({
  open,
  onOpenChange,
  wallet,
}: RenameWalletDialogProps) {
  const { renameWallet } = useWallets();
  const { toast } = useToast();
  const [newName, setNewName] = useState(wallet?.name || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleRename = async () => {
    if (!wallet || !newName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a wallet name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await renameWallet(wallet.id, newName.trim());
      toast({
        title: "Success",
        description: "Wallet renamed successfully.",
      });
      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error",
        description: `Failed to rename wallet. ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Wallet</DialogTitle>
          <DialogDescription>
            {wallet?.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input
              id="wallet-name"
              placeholder="Enter new name..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isLoading} className="flex-1">
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
