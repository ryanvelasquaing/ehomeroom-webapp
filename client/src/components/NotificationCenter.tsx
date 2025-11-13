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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, CheckCircle2, ExternalLink, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface NotificationCenterProps {
  userId: string;
}

interface Message {
  id: string;
  title: string;
  body: string;
  link: string | null;
  created_at: string;
  sent_at: string | null;
}

interface Recipient {
  id: string;
  read_at: string | null;
  status: string;
  channels_attempted: string[];
}

interface MessageWithRecipient extends Message {
  recipient: Recipient;
}

// Type for the raw Supabase response
interface RawRecipient {
  id: string;
  read_at: string | null;
  status: string;
  channels_attempted: string[];
  created_at: string;
  messages: {
    id: string;
    title: string;
    body: string;
    link: string | null;
    created_at: string;
    sent_at: string | null;
  };
}

const NotificationCenter = ({ userId }: NotificationCenterProps) => {
  const [messages, setMessages] = useState<MessageWithRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    try {
      // Query without generics
      const { data: recipients, error } = await supabase
        .from("message_recipients")
        .select(
          `
          id,
          read_at,
          status,
          channels_attempted,
          created_at,
          messages (
            id,
            title,
            body,
            link,
            created_at,
            sent_at
          )
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Cast to RawRecipient[] to remove `any`
      const formatted: MessageWithRecipient[] =
        (recipients as RawRecipient[] | null)?.map((r) => ({
          id: r.messages.id,
          title: r.messages.title,
          body: r.messages.body,
          link: r.messages.link,
          created_at: r.messages.created_at,
          sent_at: r.messages.sent_at,
          recipient: {
            id: r.id,
            read_at: r.read_at,
            status: r.status,
            channels_attempted: r.channels_attempted,
          },
        })) || [];

      setMessages(formatted);
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: "Failed to load notifications: " + error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to load notifications",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("message_updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_recipients",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchMessages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchMessages]);

  const markAsRead = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from("message_recipients")
        .update({ read_at: new Date().toISOString() })
        .eq("id", recipientId);

      if (error) throw error;

      fetchMessages();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Error",
          description: "Failed to mark as read: " + error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to mark as read",
          variant: "destructive",
        });
      }
    }
  };

  const unreadCount = messages.filter((m) => !m.recipient.read_at).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse text-muted-foreground">
            Loading notifications...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`
                  : "All caught up!"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No notifications yet
              </CardContent>
            </Card>
          ) : (
            messages.map((message) => (
              <Card
                key={message.recipient.id}
                className={`transition-colors ${
                  !message.recipient.read_at
                    ? "border-primary/50 bg-primary/5"
                    : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{message.title}</h3>
                        {!message.recipient.read_at && (
                          <Badge variant="secondary" className="text-xs">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {message.body}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(message.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                        <div className="flex gap-1">
                          {message.recipient.channels_attempted.map(
                            (channel) => (
                              <Badge
                                key={channel}
                                variant="outline"
                                className="text-xs"
                              >
                                {channel}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        {!message.recipient.read_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markAsRead(message.recipient.id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Mark as read
                          </Button>
                        )}
                        {message.link && (
                          <Button size="sm" variant="ghost" asChild>
                            <a
                              href={message.link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-4 h-4 mr-1" />
                              Open link
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NotificationCenter;
