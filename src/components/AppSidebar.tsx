import { MdSpaceDashboard } from "react-icons/md";
import { IoLink, IoLogOut } from "react-icons/io5";
import { FaMoneyBill, FaRobot } from "react-icons/fa";
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
  { title: "Agents", url: "/agents", icon: FaRobot },
];

export function AppSidebar() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <Sidebar className="border-r border-border bg-white">
      <SidebarContent>
        {/* Logo */}
        <div className="p-5 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-heading font-semibold text-foreground">
              PayAgent
            </span>
          </div>
        </div>
        
        {/* Navigation */}
        <SidebarGroup className="px-3">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-blue-50 rounded-lg transition-colors"
                      activeClassName="bg-blue-50 text-blue-700"
                    >
                      <item.icon className="h-[18px] w-[18px]" />
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
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Connect to get started
            </p>
            <ConnectButton />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {address?.slice(2, 4).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected
                </p>
                <p className="text-[11px] text-muted-foreground truncate font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
              </div>
            </div>
            <SidebarMenuButton 
              className="w-full text-muted-foreground hover:text-foreground hover:bg-blue-50 rounded-lg py-2"
              onClick={() => disconnect()}
            >
              <IoLogOut className="h-4 w-4 mr-2" />
              <span className="text-sm">Disconnect</span>
            </SidebarMenuButton>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
