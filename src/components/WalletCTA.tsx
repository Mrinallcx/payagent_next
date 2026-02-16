"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletCTA({
  className,
  label = "Connect Wallet →",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <div
          {...(!mounted && {
            "aria-hidden": true,
            style: { opacity: 0, pointerEvents: "none" as const },
          })}
        >
          <button
            onClick={openConnectModal}
            className={
              className ??
              "inline-block px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all hover:-translate-y-px"
            }
          >
            {label}
          </button>
        </div>
      )}
    </ConnectButton.Custom>
  );
}
