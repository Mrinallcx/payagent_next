import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle } from "lucide-react";

interface TransactionItemProps {
  type: "sent" | "received";
  status: "success" | "pending" | "failed";
  amount: string;
  description: string;
  date: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-success",
    bg: "bg-success/10",
  },
  pending: {
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
};

export function TransactionItem({ type, status, amount, description, date }: TransactionItemProps) {
  const StatusIcon = statusConfig[status].icon;
  const TypeIcon = type === "sent" ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 border-border">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${type === "sent" ? "bg-muted" : "bg-primary/10"}`}>
          <TypeIcon className={`h-4 w-4 ${type === "sent" ? "text-foreground" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{description}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`text-sm font-semibold ${type === "sent" ? "text-foreground" : "text-primary"}`}>
            {type === "sent" ? "-" : "+"} ${amount}
          </p>
          <div className="flex items-center gap-1 justify-end">
            <StatusIcon className={`h-3 w-3 ${statusConfig[status].color}`} />
            <span className={`text-xs capitalize ${statusConfig[status].color}`}>{status}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
