import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

interface QuickActionsProps {
  onCreateLink: () => void;
}

export function QuickActions({ onCreateLink }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      <Card 
        className="p-6 border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer" 
        onClick={onCreateLink}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-foreground">Create Payment Link</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Generate a new payment link instantly
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
