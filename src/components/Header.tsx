
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import React from "react";
import AuthButton from "./AuthButton";
import Image from "next/image";

export default function Header({ children, onAddWallet }: { children?: React.ReactNode, onAddWallet: () => void }) {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <div className="flex items-center gap-4">
         {children}
         <Image src="/branding/coffin-logo.png" alt="Crypt Coffin Logo" width={64} height={64} />
      </div>
      <div className="flex items-center gap-2">
        <AuthButton />
        <Button onClick={onAddWallet}>
          <Plus className="mr-2 h-4 w-4" /> Add Wallet
        </Button>
      </div>
    </header>
  );
}
