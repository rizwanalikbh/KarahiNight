import { useGetMe, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { LogOut, Pizza } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface LayoutProps {
  children: React.ReactNode;
  topbarExtra?: React.ReactNode;
}

export function Layout({ children, topbarExtra }: LayoutProps) {
  const { data: session } = useGetMe();
  const logout = useLogout();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        const lastSlug = localStorage.getItem("lastEventSlug");
        setLocation(lastSlug ? `/?event=${lastSlug}` : "/");
      },
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-primary font-serif font-bold text-xl hover:opacity-80 transition-opacity shrink-0">
            <Pizza className="w-6 h-6" />
            <span>Pizza Night</span>
          </Link>

          {topbarExtra && (
            <div className="flex-1 flex justify-center">
              {topbarExtra}
            </div>
          )}

          <nav className={`flex items-center gap-4 ${topbarExtra ? "" : "ml-auto"}`}>
            {session?.authenticated ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium hidden sm:inline-block">
                  Hi, {session.userName || "Admin"}
                </span>
                {session.role === "admin" && (
                  <>
                    <Link href="/admin/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
                      Dashboard
                    </Link>
                    <Link href="/kitchen" className="text-sm font-medium hover:text-primary transition-colors">
                      Kitchen
                    </Link>
                    <Link href="/recipes" className="text-sm font-medium hover:text-primary transition-colors">
                      Recipes
                    </Link>
                  </>
                )}
                {session.role === "user" && (
                  <Link href="/order" className="text-sm font-medium hover:text-primary transition-colors">
                    My Order
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground hover:text-foreground">
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-sm font-medium hover:text-primary transition-colors px-3 py-2">
                  View My Order
                </Link>
                <Link href="/admin" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
                  Admin
                </Link>
              </div>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {children}
      </main>
    </div>
  );
}
