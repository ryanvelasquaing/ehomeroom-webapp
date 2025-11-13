import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Send, Shield, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <header className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">School Announcements</span>
          </div>
          <Button onClick={() => navigate("/auth")}>Get Started</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold leading-tight">
              Keep Everyone
              <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Connected & Informed
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Multi-channel announcement system with push notifications, SMS
              fallback, and email delivery. Perfect for schools, organizations,
              and communities.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              size="lg"
              onClick={() => navigate("/auth")}
              className="shadow-lg"
            >
              <Send className="w-5 h-5 mr-2" />
              Start Sending
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-16">
            <div className="p-6 rounded-lg bg-card border space-y-3">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Multi-Channel Delivery</h3>
              <p className="text-sm text-muted-foreground">
                Push, SMS, and email with intelligent fallback handling for
                maximum reach
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border space-y-3">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-lg font-semibold">Role-Based Access</h3>
              <p className="text-sm text-muted-foreground">
                Secure authentication with admin, teacher, and parent roles
              </p>
            </div>

            <div className="p-6 rounded-lg bg-card border space-y-3">
              <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                <Bell className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Real-Time Updates</h3>
              <p className="text-sm text-muted-foreground">
                Instant notification delivery with read receipts and delivery
                tracking
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
