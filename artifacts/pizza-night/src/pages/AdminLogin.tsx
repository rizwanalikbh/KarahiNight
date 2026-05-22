import { useState, useEffect } from "react";
import { useAdminLogin, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const adminLogin = useAdminLogin();
  const { data: session } = useGetMe();

  useEffect(() => {
    if (session?.authenticated && session.role === "admin") {
      setLocation("/admin/dashboard");
    }
  }, [session, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    adminLogin.mutate({ data: { password } }, {
      onSuccess: (res) => {
        if (res.success && res.role === "admin") {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/admin/dashboard");
        } else {
          toast({
            title: "Access Denied",
            description: "Incorrect password.",
            variant: "destructive"
          });
        }
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Could not log in. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full pt-12">
        <Card className="border-card-border shadow-md">
          <CardHeader className="text-center pb-2">
            <CardTitle className="font-serif text-2xl">Kitchen Access</CardTitle>
            <CardDescription>Admin login</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="h-12"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg mt-6" 
                disabled={adminLogin.isPending || !password}
              >
                {adminLogin.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enter Kitchen"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}