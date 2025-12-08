import { MdSpaceDashboard } from "react-icons/md";
import { IoLink, IoLogOut } from "react-icons/io5";
import { FaMoneyBill } from "react-icons/fa";
import { NavLink } from "@/components/NavLink";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { Wallet } from "lucide-react";
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
  { title: "Dashboard", url: "/dashboard", icon: MdSpaceDashboard },
  { title: "Payment Links", url: "/payment-links", icon: IoLink },
  { title: "Transactions", url: "/transactions", icon: FaMoneyBill },
];

export function AppSidebar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <Sidebar className="border-r border-border bg-sidebar">
      <SidebarContent>
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground">
              PayMe
            </span>
          </div>
        </div>
        
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-3">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                      activeClassName="bg-primary/10 text-primary"
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      {/* Footer */}
      <SidebarFooter className="p-4 border-t border-border">
        {!isConnected ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground text-center mb-2">
              Connect wallet to start
            </p>
            <ConnectButton />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4 p-3 bg-accent rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold">
                {address?.slice(2, 4).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Connected</p>
                <p className="text-xs text-muted-foreground truncate font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
            </div>
            <SidebarMenuButton 
              className="w-full text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
              onClick={() => disconnect()}
            >
              <IoLogOut className="h-4 w-4 mr-2" />
              <span>Disconnect</span>
            </SidebarMenuButton>
          </>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
