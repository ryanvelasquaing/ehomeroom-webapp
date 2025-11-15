import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";

interface MessageComposerProps {
  senderId: string;
  senderRole: string;
}

type AudienceType = "all" | "role" | "class" | "individual";
type RoleType = "admin" | "parent" | "teacher";

const MessageComposer = ({ senderId, senderRole }: MessageComposerProps) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("all");
  const [audienceFilter, setAudienceFilter] = useState<string>("");
  const [channels, setChannels] = useState<string[]>(["push", "email"]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleChannelToggle = (channel: string) => {
    setChannels((prev) =>
      prev.includes(channel)
        ? prev.filter((c) => c !== channel)
        : [...prev, channel]
    );
  };

  const handleSend = async () => {
    if (!title || !body) {
      toast({
        title: "Missing fields",
        description: "Please fill in title and body",
        variant: "destructive",
      });
      return;
    }

    if (channels.length === 0) {
      toast({
        title: "No channels selected",
        description: "Please select at least one delivery channel",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create the message
      const { data: message, error: messageError } = await supabase
        .from("messages")
        .insert({
          sender_id: senderId,
          title,
          body,
          link: link || null,
          audience_type: audienceType,
          audience_filter: audienceFilter ? { value: audienceFilter } : null,
          channels,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Fetch recipients based on audience
      let recipientIds: string[] = [];

      if (audienceType === "all") {
        const { data: profiles } = await supabase.from("profiles").select("id");
        recipientIds = profiles?.map((p) => p.id) || [];
      } else if (audienceType === "role" && audienceFilter) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", audienceFilter as RoleType);
        recipientIds = profiles?.map((p) => p.id) || [];
      }

      // Create recipient records
      if (recipientIds.length > 0) {
        const recipients = recipientIds.map((userId) => ({
          message_id: message.id,
          user_id: userId,
          channels_attempted: channels,
          status: "pending",
        }));

        const { error: recipientError } = await supabase
          .from("message_recipients")
          .insert(recipients);

        if (recipientError) throw recipientError;

        // Trigger SMS delivery if SMS channel is selected
        if (channels.includes("sms")) {
          try {
            await supabase.functions.invoke("send-notification-sms", {
              body: { messageId: message.id },
            });
            console.log("SMS delivery triggered");
          } catch (smsError) {
            console.error("SMS delivery error:", smsError);
          }
        }

        // Trigger push notification delivery if push channel is selected
        if (channels.includes("push")) {
          try {
            await supabase.functions.invoke("send-push-notifications", {
              body: { messageId: message.id },
            });
            console.log("Push notification delivery triggered");
          } catch (pushError) {
            console.error("Push notification error:", pushError);
          }
        }
      }

      toast({
        title: "Message sent!",
        description: `Your message has been queued for delivery to ${recipientIds.length} recipients.`,
      });

      // Reset form
      setTitle("");
      setBody("");
      setLink("");
      setAudienceType("all");
      setAudienceFilter("");
      setChannels(["push", "email"]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      toast({
        title: "Error sending message",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compose Message</CardTitle>
        <CardDescription>
          Create and send announcements to your audience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            placeholder="Important Announcement"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="body">Message</Label>
          <Textarea
            id="body"
            placeholder="Type your message here..."
            className="min-h-32"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="link">Link (optional)</Label>
          <Input
            id="link"
            type="url"
            placeholder="https://example.com"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="audience">Audience</Label>
            <Select
              value={audienceType}
              onValueChange={(v: AudienceType) => setAudienceType(v)}
            >
              <SelectTrigger id="audience">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="role">By Role</SelectItem>
                <SelectItem value="class">By Class</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {audienceType === "role" && (
            <div className="space-y-2">
              <Label htmlFor="role">Select Role</Label>
              <Select
                value={audienceFilter}
                onValueChange={(v: string) => setAudienceFilter(v)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Choose role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parents</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Delivery Channels</Label>
          <div className="flex flex-col gap-2">
            {["push", "sms", "email"].map((channel) => (
              <div key={channel} className="flex items-center space-x-2">
                <Checkbox
                  id={channel}
                  checked={channels.includes(channel)}
                  onCheckedChange={() => handleChannelToggle(channel)}
                />
                <label htmlFor={channel} className="text-sm cursor-pointer">
                  {channel === "push"
                    ? "Push Notification"
                    : channel === "sms"
                    ? "SMS (requires verified phone)"
                    : "Email"}
                </label>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSend} disabled={loading} className="w-full">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Message
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default MessageComposer;
