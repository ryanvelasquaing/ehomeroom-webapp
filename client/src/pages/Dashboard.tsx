import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Bell, Send, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageComposer from "@/components/MessageComposer";
import NotificationCenter from "@/components/NotificationCenter";
import AdminPanel from "@/components/AdminPanel";

// Type helper for the profiles table
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch profile from Supabase
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: unknown) {
      let message = "Failed to load profile";
      if (error instanceof Error) message = error.message;

      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Logout handler
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
    toast({
      title: "Logged out",
      description: "You've been successfully logged out.",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isAdminOrTeacher =
    profile?.role === "admin" || profile?.role === "teacher";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">School Announcements</h1>
              <p className="text-sm text-muted-foreground">
                {profile?.email} • {profile?.role}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3">
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            {isAdminOrTeacher && (
              <>
                <TabsTrigger value="compose">
                  <Send className="w-4 h-4 mr-2" />
                  Compose
                </TabsTrigger>
                <TabsTrigger value="admin">
                  <Users className="w-4 h-4 mr-2" />
                  Admin
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <NotificationCenter userId={user.id} />
          </TabsContent>

          {isAdminOrTeacher && (
            <>
              <TabsContent value="compose" className="space-y-4">
                <MessageComposer senderId={user.id} senderRole={profile.role} />
              </TabsContent>
              <TabsContent value="admin" className="space-y-4">
                <AdminPanel />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;
