import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";

interface NotificationPermissionPromptProps {
  onRequest: () => void;
  onDismiss: () => void;
}

export const NotificationPermissionPrompt = ({
  onRequest,
  onDismiss,
}: NotificationPermissionPromptProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <Card className="mb-6 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">Enable Notifications</CardTitle>
              <CardDescription className="mt-1">
                Stay updated with important announcements even when the app is
                closed
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Button onClick={onRequest} className="w-full sm:w-auto">
          <Bell className="w-4 h-4 mr-2" />
          Enable Push Notifications
        </Button>
      </CardContent>
    </Card>
  );
};
