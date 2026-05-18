import { useGetSummary } from "@workspace/api-client-react";
import { Layout } from "../components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export function Home() {
  const { data: summary, isLoading } = useGetSummary();

  return (
    <Layout>
      <div className="flex flex-col items-center max-w-2xl mx-auto space-y-8 text-center">
        <div className="space-y-4">
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <img src="/pizza-icon.png" alt="Pizza" className="w-16 h-16 opacity-80" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold text-foreground">
            Private Pizza Night
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            You are invited to a cozy evening of handmade sourdough pizza. Limited spots available, pre-order only.
          </p>
        </div>

        <div className="w-full aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-lg border relative">
          <img 
            src="/pizza-hero.png" 
            alt="Handmade pizza" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6 text-left">
            <div className="text-white font-medium text-lg">70 DKK per pizza</div>
            <div className="text-white/80 text-sm">Collected money will go toward funding a future BBQ gathering.</div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="w-full h-48 rounded-xl" />
        ) : summary ? (
          <Card className="w-full bg-card border-card-border shadow-sm">
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Event Status</CardTitle>
              <CardDescription>
                {summary.totalRemaining > 0 
                  ? `${summary.totalRemaining} pizzas remaining out of ${summary.totalCapacity}`
                  : "We are completely sold out!"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-secondary/50 rounded-xl p-4 flex flex-col items-center justify-center">
                  <span className="text-3xl font-serif font-bold text-primary">{summary.totalBooked}</span>
                  <span className="text-sm text-muted-foreground">Ordered</span>
                </div>
                <div className="bg-secondary/50 rounded-xl p-4 flex flex-col items-center justify-center">
                  <span className="text-3xl font-serif font-bold text-accent">{summary.totalRemaining}</span>
                  <span className="text-sm text-muted-foreground">Available</span>
                </div>
              </div>
              
              <Link href="/login" className="block w-full">
                <Button size="lg" className="w-full text-lg h-14" disabled={!summary.orderingOpen}>
                  {summary.orderingOpen ? "Login to Order" : "Ordering Closed"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </Layout>
  );
}