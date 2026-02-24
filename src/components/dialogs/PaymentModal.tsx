"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useWallets } from "@/hooks/useWallets";
import { BrowserProvider } from "ethers";
import { BigNumber } from "bignumber.js";
import type { Token, EVMNetwork, Balance } from "@/types";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: Token[];
  networks: EVMNetwork[];
  onPaymentInitiate?: (
    token: Token,
    network: EVMNetwork,
    usdAmount: number,
  ) => Promise<void>;
}

const DONATION_AMOUNT_USD = 5;
const PAYMENT_TOKENS = ["USDT", "USDC"]; // Only stablecoins for donation

/**
 * PaymentModal - Handles cloud sync premium payment
 * Users select EVM network, then token on that network, with balance display
 */
export function PaymentModal({
  isOpen,
  onClose,
  tokens,
  networks,
  onPaymentInitiate,
}: PaymentModalProps) {
  const { toast } = useToast();
  const { balances, activeWallet, wallets } = useWallets();
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [connectedWalletId, setConnectedWalletId] = useState<string | null>(
    null,
  );

  // Only show default EVM networks (no custom networks, no BTC/Solana/NEAR)
  const supportedNetworks = useMemo(
    () => networks.filter((n) => !n.isCustom),
    [networks],
  );

  // Get balances for tokens in selected network
  const tokenBalancesMap = useMemo(() => {
    const map = new Map<string, Balance>();
    const walletId = connectedWalletId || activeWallet?.id;
    if (!walletId) return map;

    const walletBalances = balances.get(walletId) || [];
    walletBalances.forEach((balance) => {
      map.set(balance.tokenId, balance);
    });
    return map;
  }, [balances, activeWallet, connectedWalletId]);

  // Get tokens for selected network, filter to USDT/USDC with balance > 0
  const tokensForNetwork = useMemo(() => {
    if (!selectedNetwork) return [];
    return tokens
      .filter(
        (t) =>
          t.networkId === selectedNetwork &&
          PAYMENT_TOKENS.includes(t.symbol.toUpperCase()),
      )
      .filter((t) => {
        // Only show tokens with non-zero balance
        const balance = tokenBalancesMap.get(t.id);
        if (!balance) return false;
        const bn =
          typeof balance.balance === "string"
            ? new BigNumber(balance.balance)
            : balance.balance;
        return bn.isGreaterThan(0);
      });
  }, [selectedNetwork, tokens, tokenBalancesMap]);

  const handleNetworkChange = (networkId: string) => {
    setSelectedNetwork(networkId);
    setSelectedToken(""); // Reset token when network changes
  };

  // Detect currently connected signer and map to tracked wallet ID if possible
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.ethereum) return;
    (async () => {
      try {
        const provider = new BrowserProvider(window.ethereum as any);
        const signer = await provider.getSigner();
        const addr = await signer.getAddress();
        const found = wallets.find(
          (w) =>
            w.address.toLowerCase() === addr.toLowerCase() && w.type === "evm",
        );
        if (found) setConnectedWalletId(found.id);
      } catch (e) {
        setConnectedWalletId(null);
      }
    })();
  }, [isOpen, wallets]);

  const handleSubmit = async () => {
    if (!selectedToken || !selectedNetwork) {
      toast({
        title: "Please select both network and token",
        variant: "destructive",
      });
      return;
    }

    const token = tokensForNetwork.find((t) => t.id === selectedToken);
    const network = supportedNetworks.find((n) => n.id === selectedNetwork);

    if (!token || !network) {
      toast({
        title: "Invalid selection",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    try {
      if (onPaymentInitiate) {
        await onPaymentInitiate(token, network, DONATION_AMOUNT_USD);
      }
      toast({
        title: "Payment initiated",
        description: "Processing donation...",
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Payment failed";
      toast({
        title: "Payment Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enable Cloud Sync</DialogTitle>
          <DialogDescription>
            Access your portfolio from every device with cloud sync
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              To get the advantage of cloud sync and access your portfolio from
              every device, including other wallets that you own, we kindly ask
              for a <strong>$5/month donation</strong> so we can pay for the
              hosting and storage service.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              You'll always be allowed to save your data locally, for free.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Network</label>
            <Select value={selectedNetwork} onValueChange={handleNetworkChange}>
              <SelectTrigger>
                <SelectValue placeholder="Choose network..." />
              </SelectTrigger>
              <SelectContent>
                {supportedNetworks.map((network) => (
                  <SelectItem key={network.id} value={network.id}>
                    {network.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedNetwork && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Select Token ({DONATION_AMOUNT_USD} USD needed)
              </label>
              <Select value={selectedToken} onValueChange={setSelectedToken}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose payment token..." />
                </SelectTrigger>
                <SelectContent>
                  {tokensForNetwork.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No {PAYMENT_TOKENS.join("/")} tokens found on{" "}
                      {
                        supportedNetworks.find((n) => n.id === selectedNetwork)
                          ?.name
                      }
                    </div>
                  ) : (
                    tokensForNetwork.map((token) => {
                      const balance = tokenBalancesMap.get(token.id);
                      const displayBalance =
                        balance?.balance.toNumber().toFixed(4) || "0.0000";
                      return (
                        <SelectItem key={token.id} value={token.id}>
                          {token.symbol} - {displayBalance} (
                          {balance?.balanceUSD || "$0.00"})
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">Amount to donate:</p>
            <p className="text-xl font-semibold">
              ${DONATION_AMOUNT_USD}.00 USD
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedToken || !selectedNetwork || isProcessing}
              className="flex-1"
            >
              {isProcessing ? "Processing..." : "Proceed to Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
