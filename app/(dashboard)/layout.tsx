"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected, status } = useAccount();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready && status !== "reconnecting" && status !== "connecting" && !isConnected) {
      router.replace("/");
    }
  }, [ready, isConnected, status, router]);

  if (!ready || status === "reconnecting" || status === "connecting") {
    return null;
  }

  if (!isConnected) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col bg-slate-50/50">
          <AppNavbar />
          {children}
        </div>
      </div>
    </SidebarProvider>
  );
}
