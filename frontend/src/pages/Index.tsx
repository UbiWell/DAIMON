
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-6 transition-colors duration-300">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>
      
      <div className="max-w-3xl text-center space-y-6 animate-fade-in">
        <div className="inline-block mb-4">
          <div className="flex items-center gap-2 text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Interactive Dashboard
          </div>
        </div>
        
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          Beautifully designed, customizable dashboard
        </h1>
        
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          A clean, minimalist dashboard with light and dark mode support. Fully customizable with drag and drop capabilities.
        </p>
        
        <div className="flex items-center justify-center gap-4 mt-8">
          <Link to="/dashboard">
            <Button size="lg" className="rounded-full px-8 gap-2">
              View Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      
      <div className="mt-10 relative w-full max-w-5xl mx-auto">
        <div className="aspect-[16/9] overflow-hidden rounded-xl border shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-background/20 dark:from-background/90 dark:to-background/30 z-10"></div>
          <div className="relative bg-secondary/30 w-full h-full grid grid-cols-3 grid-rows-2 gap-2 p-2">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className="bg-card/90 backdrop-blur rounded-lg border flex items-center justify-center shadow-sm"
              >
                <div className="w-2/3 h-2/3 bg-primary/10 rounded-md flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-background py-2 px-4 rounded-full border shadow-sm">
          <p className="text-sm text-muted-foreground">Customizable grid layout</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
