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
import type { EVMNetwork } from "@/types";

interface EditNetworkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  network: EVMNetwork | null;
}

/**
 * EditNetworkDialog - Allows users to edit custom network properties
 */
export function EditNetworkDialog({
  open,
  onOpenChange,
  network,
}: EditNetworkDialogProps) {
  const { updateCustomNetwork } = useWallets();
  const { toast } = useToast();
  const [name, setName] = useState(network?.name || "");
  const [rpcUrl, setRpcUrl] = useState(network?.rpcUrl || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    if (!network || !name.trim() || !rpcUrl.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await updateCustomNetwork(network.id, {
        name: name.trim(),
        rpcUrl: rpcUrl.trim(),
      });
      toast({
        title: "Success",
        description: "Network updated successfully.",
      });
      onOpenChange(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        title: "Error",
        description: `Failed to update network. ${errorMessage}`,
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
          <DialogTitle>Edit Network</DialogTitle>
          <DialogDescription>
            Chain ID: {network?.chainId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="network-name">Network Name</Label>
            <Input
              id="network-name"
              placeholder="e.g., Sepolia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading || !network?.isCustom}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rpc-url">RPC URL</Label>
            <Input
              id="rpc-url"
              placeholder="https://..."
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
              disabled={isLoading || !network?.isCustom}
            />
          </div>

          {!network?.isCustom && (
            <p className="text-sm text-muted-foreground">
              Default networks cannot be edited.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isLoading || !network?.isCustom}
              className="flex-1"
            >
              {isLoading ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
