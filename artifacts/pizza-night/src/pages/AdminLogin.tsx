import { useState, useEffect } from "react";
import { useSendOtp, useVerifyOtp, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type Step = "mobile" | "otp";

export function AdminLogin() {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: session } = useGetMe();
  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  useEffect(() => {
    if (session?.authenticated && session.role === "admin") {
      setLocation("/admin/dashboard");
    }
  }, [session, setLocation]);

  const e164Mobile = `+45${mobile}`;

  const handleSendOtp = () => {
    if (mobile.length !== 8) return;
    sendOtp.mutate(
      { data: { mobile, adminMode: true } },
      {
        onSuccess: () => { setStep("otp"); setOtp("123456"); },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? "Could not send code.";
          toast({ title: "Access Denied", description: msg, variant: "destructive" });
        },
      },
    );
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return;
    verifyOtp.mutate(
      { data: { mobile: e164Mobile, code: otp, adminMode: true } },
      {
        onSuccess: (res) => {
          if (res.role === "admin") {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            setLocation("/admin/dashboard");
          } else {
            toast({ title: "Access Denied", description: "Not an admin number.", variant: "destructive" });
          }
        },
        onError: () => {
          toast({ title: "Invalid code", description: "The code is wrong or expired.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full pt-12">
        <Card className="border-card-border shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl">Kitchen Access</CardTitle>
            <CardDescription>
              {step === "mobile"
                ? "Enter your admin mobile number"
                : `Enter the 6-digit code sent to +45 ${mobile}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 mt-4">
            {step === "mobile" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="adminMobile" className="text-sm font-semibold">Mobile Number</Label>
                  <div className="flex items-center gap-2">
                    <span className="h-12 px-3 flex items-center rounded-md border border-input bg-muted text-sm font-medium text-muted-foreground shrink-0">+45</span>
                    <Input
                      id="adminMobile"
                      type="tel"
                      inputMode="numeric"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendOtp(); }}
                      placeholder="31 70 53 42"
                      className="h-12"
                      autoFocus
                      maxLength={8}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">8-digit Danish mobile number</p>
                </div>
                <Button
                  className="w-full h-12 text-base"
                  disabled={mobile.length !== 8 || sendOtp.isPending}
                  onClick={handleSendOtp}
                >
                  {sendOtp.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Verification Code"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                  <span>🔧</span>
                  <span>Test mode — code is <strong className="font-mono tracking-widest">123456</strong></span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminOtp" className="text-sm font-semibold">Verification Code</Label>
                  <Input
                    id="adminOtp"
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleVerifyOtp(); }}
                    placeholder="123456"
                    className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
                    autoFocus
                    maxLength={6}
                  />
                </div>
                <Button
                  className="w-full h-12 text-base"
                  disabled={otp.length !== 6 || verifyOtp.isPending}
                  onClick={handleVerifyOtp}
                >
                  {verifyOtp.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Enter Kitchen"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => { setStep("mobile"); setOtp(""); }}
                >
                  ← Back
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
