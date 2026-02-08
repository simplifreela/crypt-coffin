"use client";

import { useWallets } from "@/hooks/useWallets";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut, UploadCloud, Wallet } from "lucide-react";
import NextImage from "next/image";

export default function AuthButton() {
  const { user, storageMode, setStorageMode, loginWithWallet } = useWallets();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSync = () => {
    setStorageMode("cloud");
  };

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={storageMode === "local" ? handleSync : undefined}
          disabled={storageMode === "cloud"}
        >
          <UploadCloud className="mr-2 h-4 w-4" />
          {storageMode === "local" ? "Sync to Cloud" : "Using Cloud Sync"}
        </Button>
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Logout
        </Button>
      </div>
    );
  }

  return (
    <Button onClick={loginWithWallet}>
      <NextImage
        src="https://images.ctfassets.net/clixtyxoaeas/4rnpEzy1ATWRKVBOLxZ1Fm/a74dc1eed36d23d7ea6030383a4d5163/MetaMask-icon-fox.svg"
        width={32}
        height={32}
        alt="MetaMask"
      />
      Login with MetaMask
    </Button>
  );
}
