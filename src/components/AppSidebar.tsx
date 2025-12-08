import { MdSpaceDashboard } from "react-icons/md";
import { IoLink, IoLogOut } from "react-icons/io5";
import { FaMoneyBill } from "react-icons/fa";
import { NavLink } from "@/components/NavLink";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { Wallet, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: MdSpaceDashboard, color: "text-blue-500", bg: "bg-blue-500/10" },
  { title: "Payment Links", url: "/payment-links", icon: IoLink, color: "text-purple-500", bg: "bg-purple-500/10" },
  { title: "Transactions", url: "/transactions", icon: FaMoneyBill, color: "text-green-500", bg: "bg-green-500/10" },
];

export function AppSidebar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <Sidebar className="border-r border-border/50 bg-gradient-to-b from-white to-slate-50/50">
      <SidebarContent>
        {/* Logo */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-heading font-bold text-foreground block">
                PayMe
              </span>
              <span className="text-[10px] text-muted-foreground">Payment Hub</span>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <SidebarGroup className="px-3">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1.5">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl transition-all duration-200 hover:bg-white hover:shadow-md group"
                      activeClassName="bg-white shadow-lg text-foreground"
                    >
                      <div className={`p-2 rounded-lg ${item.bg} group-hover:scale-110 transition-transform`}>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pro Card */}
        <div className="px-4 mt-6">
          <div className="bg-gradient-to-br from-primary/10 to-purple-500/10 rounded-2xl p-4 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary">Web3 Payments</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Accept crypto payments from anyone, anywhere in the world.
            </p>
          </div>
        </div>
      </SidebarContent>
      
      {/* Footer */}
      <SidebarFooter className="p-4 border-t border-border/50">
        {!isConnected ? (
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <p className="text-xs font-medium text-foreground mb-1">Get Started</p>
              <p className="text-[10px] text-muted-foreground">
                Connect your wallet to continue
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3 p-3 bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-xl border border-primary/10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-white font-bold text-sm shadow-md">
                {address?.slice(2, 4).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Connected
                </p>
                <p className="text-[10px] text-muted-foreground truncate font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
            </div>
            <SidebarMenuButton 
              className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl py-2.5 transition-colors"
              onClick={() => disconnect()}
            >
              <IoLogOut className="h-4 w-4 mr-2" />
              <span className="text-sm">Disconnect</span>
            </SidebarMenuButton>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
