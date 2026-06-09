import { useState } from "react";
import { useLocation } from "wouter";
import { useSendOtp, useVerifyOtp, getGetMeQueryKey, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Check, ChevronLeft, AlertCircle } from "lucide-react";

type Step = "mobile" | "otp";

export function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const prefill = new URLSearchParams(window.location.search).get("mobile") ?? "";

  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState(prefill.replace(/^\+45/, "").replace(/\D/g, "").slice(0, 8));
  const [otpCode, setOtpCode] = useState("");
  const [noOrdersError, setNoOrdersError] = useState(false);

  const sendOtpMutation = useSendOtp();
  const verifyOtpMutation = useVerifyOtp();

  const handleSendOtp = () => {
    const trimmed = mobile.trim();
    if (!trimmed) return;
    setNoOrdersError(false);

    sendOtpMutation.mutate(
      { data: { mobile: trimmed, loginMode: true } },
      {
        onSuccess: () => {
          setStep("otp");
          setOtpCode("123456");
          window.scrollTo(0, 0);
        },
        onError: (err: any) => {
          const status = err?.response?.status;
          if (status === 403) {
            setNoOrdersError(true);
          } else {
            toast({
              title: "Couldn't send code",
              description: err?.response?.data?.error ?? "Please check your number and try again.",
              variant: "destructive",
            });
          }
        },
      }
    );
  };

  const handleVerify = () => {
    if (otpCode.length !== 6) return;
    verifyOtpMutation.mutate(
      { data: { mobile: mobile.trim(), code: otpCode } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          await queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
          setLocation("/order");
        },
        onError: (err: any) => {
          toast({
            title: "Wrong code",
            description: err?.response?.data?.error ?? "That code didn't match. Try again.",
            variant: "destructive",
          });
          setOtpCode("");
        },
      }
    );
  };

  if (step === "otp") {
    const isVerifying = verifyOtpMutation.isPending;
    return (
      <Layout>
        <div className="max-w-md mx-auto w-full pt-12">
          <Card className="border-card-border shadow-md">
            <CardHeader>
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => { setStep("mobile"); setOtpCode(""); }}
                  disabled={isVerifying}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <CardTitle className="font-serif text-2xl">Enter Code</CardTitle>
              </div>
              <CardDescription>
                We sent a 6-digit code to{" "}
                <span className="font-medium text-foreground">{mobile}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
                <span>🔧</span>
                <span>Test mode — code is <strong className="font-mono tracking-widest">123456</strong></span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otpCode" className="text-sm font-semibold">Verification Code</Label>
                <Input
                  id="otpCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="h-16 text-center text-3xl tracking-[0.5em] font-mono"
                  disabled={isVerifying}
                  autoFocus
                />
              </div>

              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2"
                disabled={otpCode.length !== 6 || isVerifying}
                onClick={handleVerify}
              >
                {isVerifying
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><Check className="w-5 h-5" /> View My Order</>}
              </Button>

              <div className="text-center">
                <button
                  onClick={handleSendOtp}
                  disabled={sendOtpMutation.isPending || isVerifying}
                  className="text-sm text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors disabled:opacity-50"
                >
                  {sendOtpMutation.isPending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full pt-12">
        <Card className="border-card-border shadow-md">
          <CardHeader>
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl">View My Order</CardTitle>
            <CardDescription>
              Enter the mobile number you used when placing your order. We'll send you a one-time code to verify.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="mobile" className="text-sm font-semibold">Mobile Number</Label>
              <div className="flex items-center gap-2">
                <span className="h-12 px-3 flex items-center rounded-md border border-input bg-muted text-sm font-medium text-muted-foreground shrink-0">+45</span>
                <Input
                  id="mobile"
                  type="tel"
                  inputMode="numeric"
                  value={mobile}
                  onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 8)); setNoOrdersError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendOtp(); }}
                  placeholder="31 70 53 42"
                  className="h-12"
                  autoFocus
                  maxLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">8-digit Danish mobile number</p>
            </div>

            {noOrdersError && (
              <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
                <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">Number not found</p>
                  <p className="text-sm text-destructive/80 mt-1">
                    We don't have an account linked to this number. Please contact the organiser to be added to the guest list.
                  </p>
                </div>
              </div>
            )}

            <Button
              size="lg"
              className="w-full h-14 text-lg"
              disabled={!mobile.trim() || sendOtpMutation.isPending}
              onClick={handleSendOtp}
            >
              {sendOtpMutation.isPending
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : "Send Verification Code"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
