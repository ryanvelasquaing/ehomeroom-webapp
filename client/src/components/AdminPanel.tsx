import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Send, CheckCircle2, XCircle } from "lucide-react";

const AdminPanel = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    deliveredMessages: 0,
    failedMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [
        { count: usersCount },
        { count: messagesCount },
        { count: deliveredCount },
        { count: failedCount },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true }),
        supabase
          .from("message_recipients")
          .select("*", { count: "exact", head: true })
          .eq("status", "delivered"),
        supabase
          .from("message_recipients")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
      ]);

      setStats({
        totalUsers: usersCount || 0,
        totalMessages: messagesCount || 0,
        deliveredMessages: deliveredCount || 0,
        failedMessages: failedCount || 0,
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse text-muted-foreground">
            Loading statistics...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
        <p className="text-muted-foreground">System overview and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">Total announcements</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {stats.deliveredMessages}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully delivered
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {stats.failedMessages}
            </div>
            <p className="text-xs text-muted-foreground">Delivery failures</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Integration Setup</CardTitle>
          <CardDescription>
            Configure delivery channels and external services
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              Firebase Cloud Messaging (FCM)
              <Badge variant="outline">Push Notifications</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure FCM for web push notifications. Visit the Firebase
              Console to obtain your credentials.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              Twilio SMS
              <Badge variant="outline">SMS Delivery</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Set up Twilio for SMS fallback. Note: Twilio offers a free trial
              but requires upgrade for production use.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold flex items-center gap-2">
              Email Service
              <Badge variant="outline">Email Delivery</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure email delivery via Resend or your preferred SMTP
              provider.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
