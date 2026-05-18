import { useState } from "react";
import { useLogin, useListUsers, useGetMe } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";

export function Login() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: users, isLoading: loadingUsers } = useListUsers();
  const login = useLogin();
  const { data: session } = useGetMe();

  // If already logged in, redirect
  if (session?.authenticated) {
    setLocation(session.role === "admin" ? "/admin/dashboard" : "/order");
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || code.length !== 4) {
      toast({
        title: "Error",
        description: "Please select your name and enter your 4-digit code.",
        variant: "destructive"
      });
      return;
    }

    login.mutate({ data: { name, code } }, {
      onSuccess: (res) => {
        if (res.success) {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation(res.role === "admin" ? "/admin/dashboard" : "/order");
        } else {
          toast({
            title: "Login failed",
            description: "Invalid code or user inactive.",
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
            <CardTitle className="font-serif text-2xl">Guest Login</CardTitle>
            <CardDescription>Select your name and enter your 4-digit invite code.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Who are you?</Label>
                <Select value={name} onValueChange={setName} disabled={loadingUsers}>
                  <SelectTrigger id="name" className="h-12">
                    <SelectValue placeholder={loadingUsers ? "Loading guests..." : "Select your name"} />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.filter(u => u.active).map((user) => (
                      <SelectItem key={user.id} value={user.name}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="code">Your 4-Digit Code</Label>
                <Input 
                  id="code" 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={code} 
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0000"
                  className="h-12 text-center text-xl tracking-widest"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-lg mt-6" 
                disabled={login.isPending || !name || code.length !== 4}
              >
                {login.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enter"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}