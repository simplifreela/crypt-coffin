"use client";
import { useWallets } from "@/hooks/useWallets";
import { WalletListItem } from "./WalletListItem";
import { Button } from "./ui/button";
import { Plus, Settings } from "lucide-react";
import { useState } from "react";
import { AddNetworkDialog } from "./dialogs/AddNetworkDialog";
import { AddOverviewDialog } from "./dialogs/AddOverviewDialog";
import { ScrollArea } from "./ui/scroll-area";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WalletList({
  activeView,
  onViewChange,
}: {
  activeView: "overview" | string;
  onViewChange: (view: "overview" | string) => void;
}) {
  const { wallets } = useWallets();
  const [isAddNetworkOpen, setIsAddNetworkOpen] = useState(false);
  const [isAddOverviewOpen, setIsAddOverviewOpen] = useState(false);

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4 space-y-2 w-full">
          <div
            onClick={() => onViewChange("overview")}
            className={cn(
              "group relative block p-3 rounded-lg cursor-pointer border-2 transition-all",
              activeView === "overview"
                ? "bg-primary/10 border-primary"
                : "border-transparent hover:bg-secondary",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="bg-background/50 p-3 rounded-full">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="font-semibold truncate">Portfolio Overview</p>
                <p className="text-xs text-muted-foreground truncate">
                  All wallets aggregated
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 w-full flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddOverviewOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> New Overview
            </Button>
          </div>

          <h2 className="text-lg font-semibold px-2 mb-2 pt-4">Wallets</h2>
          {wallets.map((wallet) => (
            <WalletListItem
              key={wallet.id}
              wallet={wallet}
              isActive={activeView === wallet.id}
              onClick={() => onViewChange(wallet.id)}
            />
          ))}
        </div>
      </ScrollArea>
      <AddOverviewDialog
        open={isAddOverviewOpen}
        onOpenChange={setIsAddOverviewOpen}
      />
    </>
  );
}
