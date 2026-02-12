import { BrowserProvider } from "ethers";
import { WalletAdapter } from "./index";

const EvmAdapter: WalletAdapter = {
  id: "evm",
  name: "Injected EVM Provider",
  supportedChains: ["evm"],
  connect: async () => {
    if (typeof (globalThis as any).window === "undefined" || typeof (globalThis as any).window.ethereum === "undefined") {
      throw new Error("No injected EVM provider found (e.g. MetaMask)");
    }
    try {
      const provider = new BrowserProvider((globalThis as any).window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      return { address, type: "evm", name: `Injected (${address.slice(0, 6)}...)` };
    } catch (e) {
      throw e;
    }
  },
};

export default EvmAdapter;
