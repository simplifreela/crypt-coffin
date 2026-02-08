import NextImage from "next/image";
import { useState } from "react";

export const CryptoIcon = ({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) => {
  const [url, setUrl] = useState(
    `https://raw.githubusercontent.com/jsupa/crypto-icons/main/icons/${symbol.toLowerCase()}.png`,
  );

  return (
    <NextImage
      className="rounded-full"
      src={url}
      defaultValue={"/favicon-32x32.png"}
      alt={symbol}
      onError={() => {
        setUrl("/favicon-32x32.png");
      }}
      width={24}
      height={24}
    />
  );
};
