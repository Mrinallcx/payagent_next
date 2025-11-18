import { LayoutDashboard, Wallet, Link2, Receipt, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Wallets", url: "/wallets", icon: Wallet },
  { title: "Payment Links", url: "/payment-links", icon: Link2 },
  { title: "Transactions", url: "/transactions", icon: Receipt },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  return (
    <Sidebar className="border-r border-border">
      <SidebarContent>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">Payme</h1>
        </div>
        
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors rounded-lg"
                      activeClassName="bg-muted text-primary"
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
      
      <SidebarFooter className="p-4 border-t border-border">
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
            JD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">John Doe</p>
            <p className="text-xs text-muted-foreground truncate">0xAb3...9dE1</p>
          </div>
        </div>
        <SidebarMenuButton className="w-full text-muted-foreground hover:text-foreground hover:bg-muted">
          <LogOut className="h-4 w-4 mr-2" />
          <span>Logout</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
