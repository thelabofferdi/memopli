import React, { useEffect } from "react";
import Landing from "./Landing.jsx";
import Auth from "./pages/Auth.jsx";
import Workspace from "./pages/Workspace.jsx";
import { session } from "./api.js";
import { navigate, useRoute } from "./router.js";

// #/              page publique
// #/connexion     connexion      #/inscription  création de compte
// #/app/…         espace client (exige une session)
export default function Root() {
  const path = useRoute();
  const isApp = path.startsWith("/app");
  const isAuth = path.startsWith("/connexion") || path.startsWith("/inscription");
  const loggedIn = Boolean(session.token);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path.split("?")[0]]);

  useEffect(() => {
    if (isApp && !loggedIn) navigate(`/connexion?suite=${encodeURIComponent(path)}`, { replace: true });
    if (isAuth && loggedIn) navigate("/app", { replace: true });
  }, [path, isApp, isAuth, loggedIn]);

  if (isApp) return loggedIn ? <Workspace path={path} /> : null;
  if (isAuth) return loggedIn ? null : <Auth mode={path.startsWith("/inscription") ? "signup" : "login"} path={path} />;
  return <Landing />;
}
