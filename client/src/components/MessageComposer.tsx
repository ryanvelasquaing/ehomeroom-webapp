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
type Role = "admin" | "parent" | "teacher";

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
          .eq("role", audienceFilter as Role);
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
      if (error instanceof Error) {
        toast({
          title: "Error sending message",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error sending message",
          description: "An unknown error occurred",
          variant: "destructive",
        });
      }
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
              onValueChange={(v) => setAudienceType(v as AudienceType)}
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
                onValueChange={(v) => setAudienceFilter(v)}
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="push"
                checked={channels.includes("push")}
                onCheckedChange={() => handleChannelToggle("push")}
              />
              <label htmlFor="push" className="text-sm cursor-pointer">
                Push Notification
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sms"
                checked={channels.includes("sms")}
                onCheckedChange={() => handleChannelToggle("sms")}
              />
              <label htmlFor="sms" className="text-sm cursor-pointer">
                SMS (requires verified phone)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="email"
                checked={channels.includes("email")}
                onCheckedChange={() => handleChannelToggle("email")}
              />
              <label htmlFor="email" className="text-sm cursor-pointer">
                Email
              </label>
            </div>
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
