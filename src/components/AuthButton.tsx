"use client";

import { useWallets } from "@/hooks/useWallets";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/client";
import { LogOut, UploadCloud, Wallet } from "lucide-react";
import NextImage from "next/image";
import { useState } from "react";
import { PaymentModal } from "@/components/dialogs/PaymentModal";
import { useToast } from "@/hooks/use-toast";
import { BrowserProvider, Contract, parseUnits } from "ethers";
import type { EVMNetwork, Token } from "@/types";
import { ZERO_ADDRESS } from "@/lib/constants";

export default function AuthButton() {
  const { user, storageMode, setStorageMode, loginWithWallet, tokens, networks } = useWallets();
  const supabase = createClient();
  const { toast } = useToast();
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSync = () => {
    // Open payment modal to initiate donation for cloud sync
    setIsPaymentOpen(true);
  };

  const recordPremiumPurchase = async (
    token: Token,
    network: EVMNetwork,
    usdAmount: number,
    txHash: string,
    amountTokenStr: string,
  ) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log("Recording premium purchase:", {
      userId: user.id,
      tokenSymbol: token.symbol,
      networkName: network.name,
      amountUSD: usdAmount,
      txHash,
    });

    const premiumPurchase = {
      amountUSD: usdAmount,
      amountToken: amountTokenStr,
      date: new Date().toISOString(),
      txHash,
      token: {
        address: token.address === ZERO_ADDRESS ? undefined : token.address,
        native: token.address === ZERO_ADDRESS,
        symbol: token.symbol,
        network: network.name,
      },
    };

    const { data: userData, error: fetchError } = await supabase
      .from("User")
      .select("premiumPurchases, premiumExpiresAt, isPremium")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Error fetching user data:", fetchError);
      throw fetchError;
    }

    const currentPurchases = userData?.premiumPurchases || [];
    const newPurchases = [...currentPurchases, premiumPurchase];

    // Calculate new premium expiration (add 1 month from now)
    const now = new Date();
    const premiumExpires = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    console.log("Updating premium status:", {
      totalPurchases: newPurchases.length,
      premiumExpiresAt: premiumExpires.toISOString(),
    });

    const { error: updateError } = await supabase
      .from("User")
      .update({
        premiumPurchases: newPurchases,
        isPremium: true,
        premiumExpiresAt: premiumExpires.toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating premium purchase:", updateError);
      throw updateError;
    }

    console.log("Premium purchase recorded successfully for user:", user.id);
    toast({
      title: "Premium Activated",
      description: "Cloud sync is now enabled for 1 month!",
    });
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
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          tokens={tokens}
          networks={networks}
          onPaymentInitiate={async (token, network, usdAmount) => {
            const donationAddress = process.env.NEXT_PUBLIC_DONATION_EVM_WALLET;
            if (!donationAddress) throw new Error("Donation wallet not configured.");
            if (!window.ethereum) throw new Error("No web3 provider available.");

            if (token.address === ZERO_ADDRESS) {
              throw new Error("Please use a stable token (USDT/USDC) for donation.");
            }

            const provider = new BrowserProvider(window.ethereum as any);
            const signer = await provider.getSigner();
            const erc20Abi = [
              "function transfer(address to, uint256 amount) returns (bool)",
              "function decimals() view returns (uint8)",
            ];
            const contract = new Contract(token.address, erc20Abi, signer);
            const decimals = await contract.decimals();
            const amount = parseUnits(usdAmount.toString(), decimals);
            const tx = await contract.transfer(donationAddress, amount);
            const receipt = await tx.wait();
            
            if (!receipt) throw new Error("Transaction failed");

            // Record the premium purchase
            await recordPremiumPurchase(
              token,
              network,
              usdAmount,
              receipt.hash,
              amount.toString(),
            );

            // After successful donation enable cloud sync
            setStorageMode("cloud");
          }}
        />
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
