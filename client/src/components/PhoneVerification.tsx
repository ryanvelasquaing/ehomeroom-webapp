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
import { useToast } from "@/hooks/use-toast";
import { Phone, Check, Loader2 } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface PhoneVerificationProps {
  userId: string;
  currentPhone: string | null;
  isVerified: boolean;
  onVerified: () => void;
}

const PhoneVerification = ({
  userId,
  currentPhone,
  isVerified,
  onVerified,
}: PhoneVerificationProps) => {
  const [phone, setPhone] = useState(currentPhone || "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendVerificationCode = async () => {
    if (!phone) {
      toast({
        title: "Phone required",
        description: "Please enter your phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update phone in profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ phone_e164: phone })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Call edge function to send SMS
      const { data, error } = await supabase.functions.invoke(
        "send-verification-sms",
        {
          body: { phoneNumber: phone },
        }
      );

      if (error) throw error;

      setCodeSent(true);

      // Show the code if in dev mode
      if (data?.devMode && data?.code) {
        toast({
          title: "Dev Mode - Code sent!",
          description: `Your verification code is: ${data.code}`,
          duration: 10000,
        });
      } else {
        toast({
          title: "Code sent!",
          description: "Check your phone for the verification code.",
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (!code || code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter the 6-digit code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("verify-phone", {
        body: { code },
      });

      if (error) throw error;

      toast({
        title: "Phone verified!",
        description: "Your phone number has been verified successfully.",
      });
      onVerified();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      toast({
        title: "Verification failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            Phone Verified
          </CardTitle>
          <CardDescription>
            Your phone number {currentPhone} is verified and ready for SMS
            notifications.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Verify Phone Number
        </CardTitle>
        <CardDescription>
          Verify your phone to receive SMS notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!codeSent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US, +63 for Philippines)
              </p>
            </div>
            <Button
              onClick={sendVerificationCode}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Verification Code"
              )}
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Enter 6-digit code</Label>
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={verifyCode}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCodeSent(false)}
                disabled={loading}
              >
                Change Number
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PhoneVerification;
