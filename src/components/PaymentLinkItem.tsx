import { Link2, Copy, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PaymentLinkItemProps {
  title: string;
  amount: string;
  clicks: number;
  link: string;
}

export function PaymentLinkItem({ title, amount, clicks, link }: PaymentLinkItemProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 border-border">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/20">
          <Link2 className="h-4 w-4 text-accent-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{clicks} clicks</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-primary">${amount}</p>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
