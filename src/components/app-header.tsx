import { Link } from "@tanstack/react-router";
import { ArrowLeft, Landmark, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader({ onSignOut }: { onSignOut?: () => void }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:flex sm:justify-between sm:gap-3 sm:px-8 sm:py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2 font-display text-base font-bold text-primary">
          <Landmark className="h-6 w-6 shrink-0 text-teal" /><span className="truncate">Kindred Bank</span>
        </Link>
        {onSignOut && (
          <nav aria-label="Page navigation" className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="sm" className="h-11 w-11 p-0 sm:h-9 sm:w-auto sm:px-3" asChild>
              <Link to="/" aria-label="All assistants" title="All assistants"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">All assistants</span></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-9 sm:w-9" onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}