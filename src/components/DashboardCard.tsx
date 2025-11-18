import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface DashboardCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DashboardCard({ title, action, children }: DashboardCardProps) {
  return (
    <Card className="p-5 border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}
