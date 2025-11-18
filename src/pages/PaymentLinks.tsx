import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";

const PaymentLinks = () => {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-3xl font-bold text-foreground mb-2">Payment Links</h1>
              <p className="text-muted-foreground">Create and manage your payment links.</p>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default PaymentLinks;
