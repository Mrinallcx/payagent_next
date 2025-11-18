import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Shield, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();
  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john@example.com");
  const [phone, setPhone] = useState("+1 234 567 8900");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const handleUpdateProfile = () => {
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved.",
    });
  };

  const handleToggle2FA = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    toast({
      title: twoFactorEnabled ? "2FA disabled" : "2FA enabled",
      description: twoFactorEnabled 
        ? "Two-factor authentication has been disabled." 
        : "Two-factor authentication has been enabled.",
    });
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Account deletion requested",
      description: "Your account deletion request has been submitted.",
      variant: "destructive",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-3 sm:p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your account preferences</p>
              </div>

              {/* Profile Information */}
              <Card className="p-4 border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Profile Information</h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm">Name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button onClick={handleUpdateProfile} className="h-9 text-sm w-full sm:w-auto">
                    Save Changes
                  </Button>
                </div>
              </Card>

              {/* Two-Factor Authentication */}
              <Card className="p-4 border-border">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">Two-Factor Authentication</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    checked={twoFactorEnabled}
                    onCheckedChange={handleToggle2FA}
                  />
                </div>
                {twoFactorEnabled && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Scan this QR code with your authenticator app
                      </p>
                      <div className="bg-muted rounded-lg p-8 flex items-center justify-center">
                        <div className="h-32 w-32 bg-background border-2 border-border rounded-md flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">QR Code</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="code" className="text-sm">Verification Code</Label>
                        <Input
                          id="code"
                          placeholder="Enter 6-digit code"
                          className="h-9 text-sm"
                        />
                      </div>
                      <Button size="sm" className="h-8 text-xs w-full sm:w-auto">
                        Verify
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              {/* Danger Zone */}
              <Card className="p-4 border-destructive/50 bg-destructive/5">
                <div className="flex items-start gap-3">
                  <Trash2 className="h-4 w-4 text-destructive mt-0.5" />
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-foreground mb-1">Delete Account</h2>
                    <p className="text-sm text-muted-foreground mb-4">
                      Permanently delete your account and all associated data
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="h-8 text-xs">
                          Request Account Deletion
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete your account
                            and remove all your data from our servers.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive hover:bg-destructive/90">
                            Delete Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Settings;
