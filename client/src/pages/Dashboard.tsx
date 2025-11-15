import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, type Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Bell, Send, Users, Phone, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageComposer from "@/components/MessageComposer";
import NotificationCenter from "@/components/NotificationCenter";
import AdminPanel from "@/components/AdminPanel";
import PhoneVerification from "@/components/PhoneVerification";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { NotificationPermissionPrompt } from "@/components/NotificationPermissionPrompt";
import { DeliveryStatusDashboard } from "@/components/DeliveryStatusDashboard";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { permission, isSupported, requestPermission } = usePushNotifications(
    user?.id
  );

  // Handle auth state changes
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

  // Fetch profile and role
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);

      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (roleError) throw roleError;
      setUserRole(roleData?.role ?? null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load profile";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user?.id, toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  const isAdminOrTeacher = userRole === "admin" || userRole === "teacher";

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
                {profile?.email} {userRole && `• ${userRole}`}
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
        {isSupported && permission !== "granted" && showNotificationPrompt && (
          <NotificationPermissionPrompt
            onRequest={requestPermission}
            onDismiss={() => setShowNotificationPrompt(false)}
          />
        )}

        <Tabs defaultValue="notifications" className="space-y-6">
          <TabsList
            className={`grid w-full max-w-md mx-auto ${
              isAdminOrTeacher ? "grid-cols-5" : "grid-cols-2"
            }`}
          >
            <TabsTrigger value="notifications">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="phone">
              <Phone className="w-4 h-4 mr-2" />
              Phone
            </TabsTrigger>
            {isAdminOrTeacher && (
              <>
                <TabsTrigger value="compose">
                  <Send className="w-4 h-4 mr-2" />
                  Compose
                </TabsTrigger>
                <TabsTrigger value="status">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Status
                </TabsTrigger>
                <TabsTrigger value="admin">
                  <Users className="w-4 h-4 mr-2" />
                  Admin
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="notifications" className="space-y-4">
            <NotificationCenter userId={user?.id ?? ""} />
          </TabsContent>

          <TabsContent value="phone" className="space-y-4">
            <PhoneVerification
              userId={user?.id ?? ""}
              currentPhone={profile?.phone_e164 ?? null}
              isVerified={profile?.phone_verified ?? false}
              onVerified={fetchProfile}
            />
          </TabsContent>

          {isAdminOrTeacher && (
            <>
              <TabsContent value="compose" className="space-y-4">
                <MessageComposer
                  senderId={user?.id ?? ""}
                  senderRole={userRole ?? "parent"}
                />
              </TabsContent>
              <TabsContent value="status" className="space-y-4">
                <DeliveryStatusDashboard />
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
