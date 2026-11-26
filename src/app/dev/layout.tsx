/**
 * Wraps every /dev/* page. They are tools for building the game (sprite
 * galleries, an engine sandbox, a sound board…), so they only exist while
 * developing: a deployed site answers 404 for all of them.
 */
import { notFound } from "next/navigation";

export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
