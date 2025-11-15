import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Bell,
  Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DeliveryLog {
  id: string;
  channel: "sms" | "push" | "email";
  status: "delivered" | "failed" | "pending" | string;
  timestamp: string;
  error_message: string | null;
  message_id: string;
  messages: {
    title: string;
  } | null;
}

export const DeliveryStatusDashboard = () => {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchDeliveryLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from<DeliveryLog>("delivery_logs")
        .select(
          `
          *,
          messages (
            title
          )
        `
        )
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) throw error;

      setLogs(data || []);

      // Calculate stats
      const total = data?.length || 0;
      const delivered =
        data?.filter((log) => log.status === "delivered").length || 0;
      const failed = data?.filter((log) => log.status === "failed").length || 0;
      const pending =
        data?.filter((log) => log.status === "pending").length || 0;

      setStats({ total, delivered, failed, pending });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load delivery logs";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDeliveryLogs();

    // Set up realtime subscription
    const channel = supabase
      .channel("delivery-logs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_logs",
        },
        fetchDeliveryLogs
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDeliveryLogs]);

  const getChannelIcon = (channel: DeliveryLog["channel"]) => {
    switch (channel) {
      case "sms":
        return <MessageSquare className="w-4 h-4" />;
      case "push":
        return <Bell className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: DeliveryLog["status"]) => {
    switch (status) {
      case "delivered":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Delivered
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">
          Loading delivery logs...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Delivered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.delivered}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total > 0
                ? Math.round((stats.delivered / stats.total) * 100)
                : 0}
              % success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failed}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Delivery Logs</CardTitle>
          <CardDescription>
            Real-time delivery status for SMS, email, and push notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {new Date(log.timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.messages?.title ?? "N/A"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getChannelIcon(log.channel)}
                      <span className="capitalize">{log.channel}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {log.error_message ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    No delivery logs yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
