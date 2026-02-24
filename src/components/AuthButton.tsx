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
            try {
              const donationAddress = process.env.NEXT_PUBLIC_DONATION_EVM_WALLET;
              if (!donationAddress) throw new Error("Donation wallet not configured.");
              if (!window.ethereum) throw new Error("No web3 provider available.");

              if (token.address === ZERO_ADDRESS) {
                throw new Error("Please use a stable token (USDT/USDC) for donation.");
              }

              console.log("Payment initiation:", {
                tokenAddress: token.address,
                tokenSymbol: token.symbol,
                networkId: network.id,
                networkName: network.name,
                chainId: network.chainId,
              });

              const provider = new BrowserProvider(window.ethereum as any);
              const signer = await provider.getSigner();
              const signerAddress = await signer.getAddress();
              let chainId = (await provider.getNetwork()).chainId;
              
              console.log("Connected to chain:", chainId, "Expected network chainId:", network.chainId);

              // If on wrong network, request switch
              if (network.chainId !== chainId) {
                console.log(`Requesting switch from chain ${chainId} to ${network.chainId}`);
                try {
                  await (window.ethereum as any).request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: `0x${network.chainId.toString(16)}` }],
                  });
                  console.log("Network switched successfully");
                  // Re-create provider after network switch
                  const newProvider = new BrowserProvider(window.ethereum as any);
                  chainId = (await newProvider.getNetwork()).chainId;
                  console.log("New chain ID after switch:", chainId);
                } catch (switchError: any) {
                  // User rejected or chain doesn't exist
                  if (switchError.code === 4902) {
                    throw new Error(
                      `Network ${network.name} not added to your wallet. Please add it manually.`
                    );
                  }
                  if (switchError.code === 4001) {
                    throw new Error("You rejected the network switch request.");
                  }
                  throw new Error(`Failed to switch network: ${switchError.message}`);
                }
              }
              
              const erc20Abi = [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function balanceOf(address account) view returns (uint256)",
              ];
              
              // Create fresh provider after potential network switch
              const freshProvider = new BrowserProvider(window.ethereum as any);
              const freshSigner = await freshProvider.getSigner();
              const readOnlyContract = new Contract(token.address, erc20Abi, freshProvider);
              
              let decimals: number = 6;
              try {
                console.log("Fetching decimals for token at:", token.address);
                decimals = await readOnlyContract.decimals();
                console.log("Token decimals:", decimals);
              } catch (e) {
                console.error("Failed to fetch token decimals:", e);
                console.warn("Using default decimals of 6");
              }

              // Calculate token amount: for a $5 donation, use 5 token units
              const amount = parseUnits("5", decimals);
              console.log("Transfer amount (in wei):", amount.toString());
              
              // Check balance before attempting transfer
              let userBalance: bigint = 0n;
              try {
                console.log("Checking balance for address:", signerAddress);
                userBalance = await readOnlyContract.balanceOf(signerAddress);
                console.log("User balance:", userBalance.toString());
              } catch (e) {
                console.error("Failed to check balance:", e);
                throw new Error("Could not verify your token balance. The token may not exist on this network.");
              }

              if (userBalance < amount) {
                throw new Error(
                  `Insufficient balance. You have ${userBalance.toString()} wei, need ${amount.toString()} wei (5 ${token.symbol})`
                );
              }

              // Now execute transfer with fresh signer
              const signerContract = new Contract(token.address, erc20Abi, freshSigner);
              
              let tx;
              try {
                console.log("Executing transfer to:", donationAddress);
                tx = await signerContract.transfer(donationAddress, amount);
                console.log("Transaction sent:", tx.hash);
              } catch (e: any) {
                console.error("Transfer execution error:", e);
                const errorMsg = e?.reason || e?.message || "Transaction failed";
                
                if (errorMsg.includes("insufficient") || errorMsg.includes("balance")) {
                  throw new Error(`Insufficient balance to complete transfer`);
                }
                if (errorMsg.includes("not a function")) {
                  throw new Error(`Token contract does not support transfers. Is this a valid ERC20 token?`);
                }
                
                throw new Error(`Transfer failed: ${errorMsg}`);
              }

              // Wait for receipt
              console.log("Waiting for transaction receipt...");
              const receipt = await tx.wait();
              
              if (!receipt) {
                throw new Error("Transaction did not complete. Please try again.");
              }

              console.log("Transaction confirmed:", receipt.hash);

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
              toast({
                title: "Payment Successful!",
                description: "Thank you for your donation. Cloud sync is now enabled.",
              });
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : "Payment failed";
              console.error("Payment error:", error);
              throw new Error(errorMsg);
            }
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
