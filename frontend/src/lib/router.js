import { useEffect, useState } from "react";

// Routage minimal par ancre (#/…) : aucune dépendance, et une URL qui marche
// derrière n'importe quel serveur statique, y compris le montage de FastAPI.
export const currentPath = () => window.location.hash.replace(/^#/, "") || "/";

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (replace) window.location.replace(target);
  else window.location.hash = path;
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onHash = () => setPath(currentPath());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return path;
}
