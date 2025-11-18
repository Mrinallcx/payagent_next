import { Wallet, ArrowUpRight, ArrowDownLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
interface WalletItemProps {
  name: string;
  address: string;
  balance: string;
  currency: string;
}
export function WalletItem({
  name,
  address,
  balance,
  currency
}: WalletItemProps) {
  return <div className="p-3 bg-muted rounded-lg">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">{name}</p>
            <p className="text-xs text-muted-foreground">{address}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Settings className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="pl-6">
        <p className="text-xl font-bold text-foreground">${balance}</p>
        <p className="text-xs text-muted-foreground">{currency}</p>
      </div>
    </div>;
}