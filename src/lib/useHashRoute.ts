import { useEffect, useState } from "react";
import { DEFAULT_PATH, findRoute } from "./routes";

const split = () => {
  const [p, q = ""] = window.location.hash.replace(/^#/, "").split("?");
  return { path: p || DEFAULT_PATH, search: q };
};

const read = () => {
  const { path } = split();
  return findRoute(path) ? path : null; // null = not found
};

export function useHashRoute(): string | null {
  const [path, setPath] = useState<string | null>(read);
  useEffect(() => {
    if (!window.location.hash) window.location.replace(`#${DEFAULT_PATH}`);
    const on = () => setPath(read());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return path;
}

/** The query part of the address (#/screen?emp=e2), live: it changes when the hash does. */
export function useRouteQuery(): URLSearchParams {
  const [search, setSearch] = useState(() => split().search);
  useEffect(() => {
    const on = () => setSearch(split().search);
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return new URLSearchParams(search);
}

/** Go to a screen, with optional query values. */
export const navigate = (path: string, query?: Record<string, string | undefined>) => {
  const q = query ? new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString() : "";
  window.location.hash = q ? `${path}?${q}` : path;
};

/** The address of a screen, for an href. */
export const hrefTo = (path: string, query?: Record<string, string | undefined>) => {
  const q = query ? new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString() : "";
  return q ? `#${path}?${q}` : `#${path}`;
};
