import React, { useEffect } from "react";
import LandingV1 from "./landing/LandingV1.jsx";
import Landing from "./landing/Landing.jsx";
import Auth from "./pages/Auth.jsx";
import Workspace from "./pages/Workspace.jsx";
import { session } from "./lib/api.js";
import { navigate, useRoute } from "./lib/router.js";

// #/              page publique (v2, inspirée de « mesa »)
// #/v1            ancienne page publique, gardée le temps de la validation
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
  // v1 gardée le temps de la validation ; /v2 reste un alias de la page actuelle
  if (path.startsWith("/v1")) return <LandingV1 />;
  return <Landing />;
}
