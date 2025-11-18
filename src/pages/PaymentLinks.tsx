import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Eye, Trash2, Plus, Clock } from "lucide-react";
import { toast } from "sonner";

interface PaymentLinkData {
  id: string;
  title: string;
  description: string;
  amount: string;
  currency: string;
  expiresAt: Date;
  link: string;
}

const mockPaymentLinks: PaymentLinkData[] = [
  {
    id: "1",
    title: "Testing",
    description: "cc",
    amount: "20",
    currency: "USDT",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/abc123",
  },
  {
    id: "2",
    title: "Web Design Project",
    description: "Final payment for website",
    amount: "500",
    currency: "USDT",
    expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/xyz789",
  },
  {
    id: "3",
    title: "Consulting Session",
    description: "One hour session",
    amount: "150",
    currency: "USDT",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    link: "https://payme.app/pay/def456",
  },
];

const PaymentLinks = () => {
  const [paymentLinks, setPaymentLinks] = useState<PaymentLinkData[]>(mockPaymentLinks);
  const [, setCurrentTime] = useState(new Date());

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
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Link
                </Button>
              </div>

              <div className="space-y-4">
                {paymentLinks.map((link) => (
                  <div
                    key={link.id}
                    className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <LinkIcon className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {link.title}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {link.description}
                          </p>
                          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 font-semibold">
                            {link.amount} {link.currency}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewLink(link.link)}
                            className="gap-2"
                          >
                            <Eye className="h-3 w-3" />
                            View Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveLink(link.id, link.title)}
                            className="gap-2 text-destructive hover:text-destructive border-destructive/50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </Button>
                        </div>
                        
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>Expires in: {calculateTimeRemaining(link.expiresAt)}</span>
                        </div>
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
    </SidebarProvider>
  );
};

export default PaymentLinks;
