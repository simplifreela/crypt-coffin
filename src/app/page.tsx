
"use client";

import { WalletProvider } from '@/contexts/WalletContext';
import { useWallets } from '@/hooks/useWallets';
import Header from "@/components/Header";
import WalletList from "@/components/WalletList";
import TokenList from "@/components/TokenList";
import Overview from "@/components/Overview";
import { AddWalletDialog } from "@/components/dialogs/AddWalletDialog";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { PanelLeft } from 'lucide-react';

function PageContent() {
  const { wallets, activeWallet, setActiveWallet, loading } = useWallets();
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | string>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleViewChange = (view: 'overview' | string) => {
    setActiveView(view);
    if (view === 'overview') {
      setActiveWallet(null);
    } else {
      const newActiveWallet = wallets.find(w => w.id === view);
      if (newActiveWallet) {
        setActiveWallet(newActiveWallet);
      }
    }
    if (isMobile) {
        setIsSidebarOpen(false);
    }
  }

  const renderContent = () => {
    if (loading && wallets.length === 0) {
      return <LoadingState />;
    }
    if (wallets.length === 0) {
      return <EmptyState onAddWallet={() => setIsAddWalletOpen(true)} />;
    }

    const mainContent = activeView === 'overview' ? <Overview /> : (activeWallet ? <TokenList /> : <SelectWalletState />);

    if (isMobile) {
        return (
             <div className="p-4 md:p-6 h-full overflow-y-auto">
                {mainContent}
             </div>
        );
    }

    return (
      <div className="flex flex-1 h-full border-t">
        <aside className="w-full md:w-1/4 min-w-[280px] max-w-[350px] border-r border-border h-full overflow-y-auto">
          <WalletList activeView={activeView} onViewChange={handleViewChange} />
        </aside>
        <main className="flex-1 p-6 h-full overflow-y-auto">
          {mainContent}
        </main>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
       <Header onAddWallet={() => setIsAddWalletOpen(true)}>
            {isMobile && wallets.length > 0 && (
                <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                            <PanelLeft className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 w-full max-w-sm">
                        <WalletList activeView={activeView} onViewChange={handleViewChange} />
                    </SheetContent>
                </Sheet>
            )}
        </Header>
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
      <AddWalletDialog open={isAddWalletOpen} onOpenChange={setIsAddWalletOpen} />
    </div>
  );
}

const EmptyState = ({ onAddWallet }: { onAddWallet: () => void }) => (
  <div className="flex flex-col items-center justify-center h-full text-center p-8">
    <div className="max-w-xl w-full mx-auto mb-6 overflow-hidden rounded-lg opacity-[0.3]">
        <video
            src="/branding/dash-screen.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-auto"
        />
    </div>
    <h2 className="text-2xl font-bold mb-2">Welcome to Crypt Coffin</h2>
    <p className="text-muted-foreground mb-6 max-w-md">Your secure vault for all crypto assets. Connect a wallet or add an address to start tracking.</p>
    <Button onClick={onAddWallet} size="lg">Add Your First Wallet</Button>
  </div>
);

const LoadingState = () => (
    <div className="flex flex-1 h-full border-t">
        <aside className="w-1/4 min-w-[280px] max-w-[350px] border-r border-border p-4 space-y-2 hidden md:block">
          <h2 className="text-lg font-semibold px-2 mb-2">Wallets</h2>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </aside>
        <main className="flex-1 p-6 space-y-4">
           <div className="flex justify-between items-center">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <div className="space-y-2 pt-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
        </main>
    </div>
);

const SelectWalletState = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <h2 className="text-2xl font-bold mb-2">Select a Wallet</h2>
        <p className="text-muted-foreground">Choose a wallet from the list to see your assets.</p>
    </div>
);


export default function Home() {
    return (
        <WalletProvider>
            <PageContent />
        </WalletProvider>
    );
}
