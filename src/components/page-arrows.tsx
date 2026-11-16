import { useEffect, useState } from "react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageArrows() {
  const router = useRouter();
  const index = useRouterState({ select: (state) => state.location.state.__TSR_index ?? 0 });
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [furthest, setFurthest] = useState(index);
  useEffect(() => { setFurthest((previous) => Math.max(previous, index)); }, [index]);

  if (pathname === "/" || pathname.startsWith("/admin")) return null;
  return <nav aria-label="Page history" className="fixed bottom-3 left-3 z-40 flex shrink-0 items-center gap-1 rounded-md bg-card p-1 shadow-md sm:bottom-4 sm:left-4">
    {index === 0 && pathname !== "/" ? (
      <Button asChild variant="outline" size="icon" className="h-11 w-11">
        <Link to="/" aria-label="Go back" title="Go back to the landing page"><ArrowLeft className="h-4 w-4" /></Link>
      </Button>
    ) : (
      <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Go back" title="Go back" disabled={index === 0} onClick={() => router.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
    )}
    <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Go forward" title="Go forward" disabled={index >= furthest} onClick={() => router.history.forward()}><ArrowRight className="h-4 w-4" /></Button>
  </nav>;
}