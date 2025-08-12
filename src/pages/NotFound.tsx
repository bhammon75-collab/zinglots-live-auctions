import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>404 | ZingLots</title>
        <meta name="description" content="Page not found on ZingLots." />
      </Helmet>
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-extrabold">404</h1>
          <p className="mt-2 text-lg text-muted-foreground">Oops! Page not found</p>
          <a href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
            Return to Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
