import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Eye, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";
import { CreateLinkModal } from "@/components/CreateLinkModal";

interface PaymentLinkData {
  id: string;
  title: string;
  description: string;
  amount: string;
  token: string;
  network: string;
  expiresAt: Date;
  link: string;
}

const mockPaymentLinks: PaymentLinkData[] = [
  {
    id: "1",
    title: "Testing",
    description: "cc",
    amount: "20",
    token: "USDT",
    network: "ETH",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/abc123",
  },
  {
    id: "2",
    title: "Web Design Project",
    description: "Final payment for website",
    amount: "500",
    token: "USDT",
    network: "BASE",
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/xyz789",
  },
  {
    id: "3",
    title: "Consulting Session",
    description: "One hour session",
    amount: "150",
    token: "USDT",
    network: "SOL",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/def456",
  },
];

const PaymentLinks = () => {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkData[]>(mockPaymentLinks);
  const [, setCurrentTime] = useState(new Date());
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const calculateTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  const handleViewLink = (link: string) => {
    window.open(link, "_blank");
    toast.success("Opening payment link...");
  };

  const handleRemoveLink = (id: string, title: string) => {
    setPaymentLinks(paymentLinks.filter((link) => link.id !== id));
    toast.success(`"${title}" removed successfully`);
  };

  const handleCreateLink = (linkData: {
    title: string;
    description: string;
    amount: string;
    token: string;
    network: string;
    expiresInDays: number;
    link: string;
  }) => {
    const newLink: PaymentLinkData = {
      id: Date.now().toString(),
      title: linkData.title,
      description: linkData.description,
      amount: linkData.amount,
      token: linkData.token,
      network: linkData.network,
      expiresAt: new Date(Date.now() + linkData.expiresInDays * 24 * 60 * 60 * 1000),
      link: linkData.link,
    };
    setPaymentLinks([newLink, ...paymentLinks]);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Payment Links</h1>
                  <p className="text-muted-foreground">Create and manage your payment links.</p>
                </div>
                <Button className="gap-2" onClick={() => setIsCreateLinkOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create Link
                </Button>
              </div>

              <div className="space-y-3">
                {paymentLinks.map((link) => (
                  <div
                    key={link.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-foreground truncate">
                            {link.title}
                          </h3>
                          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold text-xs">
                            {link.amount} {link.token}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                          {link.description}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{calculateTimeRemaining(link.expiresAt)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2 sm:flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewLink(link.link)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Eye className="h-3 w-3" />
                          <span className="hidden sm:inline">View</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveLink(link.id, link.title)}
                          className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive border-destructive/50"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {paymentLinks.length === 0 && (
                  <div className="text-center py-12">
                    <LinkIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No payment links yet. Create your first one!</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      
      <CreateLinkModal 
        open={isCreateLinkOpen} 
        onOpenChange={setIsCreateLinkOpen}
        onCreateLink={handleCreateLink}
      />
    </SidebarProvider>
  );
};

export default PaymentLinks;
