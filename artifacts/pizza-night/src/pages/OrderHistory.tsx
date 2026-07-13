import { useGetMe, useListOrders } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Layout } from "../components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, History, ChevronRight } from "lucide-react";

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return dateStr; }
}

export function OrderHistory() {
  const { data: session, isLoading: sessionLoading } = useGetMe();
  const isAuthenticated = session?.authenticated === true && session?.role === "user";

  const { data: orders, isLoading: ordersLoading } = useListOrders(
    {},
    { query: { enabled: isAuthenticated } }
  );

  if (sessionLoading || (isAuthenticated && ordersLoading)) {
    return (
      <Layout>
        <div className="flex justify-center pt-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="max-w-xl mx-auto w-full pt-8">
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <History className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Log In to View Orders</h2>
              <p className="text-muted-foreground mb-6">Log in with your name and code to see your previous orders.</p>
              <Link href="/login" className="text-primary font-medium underline underline-offset-2 hover:text-primary/80">
                Go to login
              </Link>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const sortedOrders = [...(orders ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Layout>
      <div className="max-w-xl mx-auto w-full pt-8 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-serif font-bold text-foreground">Previous Orders</h1>
          <p className="text-sm text-muted-foreground">Every karahi night order you've placed.</p>
        </div>

        {sortedOrders.length === 0 ? (
          <Card className="border-card-border shadow-md text-center bg-secondary/20">
            <CardContent className="pt-10 pb-10 flex flex-col items-center">
              <History className="w-16 h-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-serif font-bold text-foreground mb-2">No Orders Yet</h2>
              <p className="text-muted-foreground">You haven't placed any orders yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map((order) => (
              <Link key={order.id} href={`/receipt/${order.id}`}>
                <Card className="border-card-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer">
                  <CardContent className="py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{order.eventName}</p>
                      <p className="text-sm text-muted-foreground">{formatEventDate(order.eventDate)} · {order.pickupSlot} CET</p>
                      {order.orderCode && (
                        <span className="inline-block mt-1 text-xs font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded tracking-wide">
                          #{order.orderCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${order.status === "confirmed" ? "bg-accent/10 text-accent" : order.status === "completed" ? "bg-gray-100 text-gray-800" : order.status === "declined" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        {order.status}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
