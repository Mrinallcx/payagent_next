import { Wallet, Settings } from "lucide-react";
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
  return <div className="p-2 bg-muted rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-3 w-3 text-primary" />
          <div>
            <p className="text-xs font-medium text-foreground">{name}</p>
            <p className="text-[10px] text-muted-foreground">{address}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-5 w-5">
          <Settings className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="mt-1.5 pl-5">
        <p className="text-base font-bold text-foreground">${balance}</p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </div>
    </div>;
}