import { Wallet, ArrowUpRight, ArrowDownLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WalletItemProps {
  name: string;
  address: string;
  balance: string;
  currency: string;
}

export function WalletItem({ name, address, balance, currency }: WalletItemProps) {
  return (
    <div className="p-4 bg-muted rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{address}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="mb-3">
        <p className="text-2xl font-bold text-foreground">${balance}</p>
        <p className="text-xs text-muted-foreground">{currency}</p>
      </div>
      
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 gap-2">
          <ArrowUpRight className="h-3 w-3" />
          Send
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-2">
          <ArrowDownLeft className="h-3 w-3" />
          Receive
        </Button>
      </div>
    </div>
  );
}
