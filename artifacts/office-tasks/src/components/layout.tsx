import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  CheckSquare, 
  Tags, 
  BarChart3, 
  Users, 
  LogOut,
  Moon,
  Sun
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, isError } = useGetMe({ 
    query: { 
      queryKey: getGetMeQueryKey(),
      retry: false,
    } 
  });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token || isError) {
      setLocation("/login");
    }
  }, [isError, setLocation]);

  if (isLoading || (!user && !isError)) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  if (!user) return null;

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    queryClient.clear();
    setLocation("/login");
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/categories", label: "Categories", icon: Tags },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    ...(user.role === "admin" ? [{ href: "/users", label: "Users", icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r bg-card/50 backdrop-blur-sm">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary tracking-tight">Task Management System</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'}`} data-testid={`nav-${item.label.toLowerCase()}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar_url || ""} />
                <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.role}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="btn-theme-toggle">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={handleLogout} data-testid="btn-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0 h-[100dvh] overflow-y-auto">
        <div className="flex-1 p-4 md:p-8">
          {children}
        </div>
      </main>
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card flex justify-around p-2 pb-safe z-50">
        {navItems.slice(0, 4).map((item) => {
          const isActive = location.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center p-2 rounded-md ${isActive ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`nav-mobile-${item.label.toLowerCase()}`}>
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
