import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { Home } from "./pages/Home";
import { AdminConfig } from "./pages/AdminConfig";
import { AdminDashboard } from "./pages/AdminDashboard";
import { Station } from "./pages/Station";

const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  { path: "/admin/:code", element: <AdminConfig /> },
  { path: "/admin/:code/dashboard", element: <AdminDashboard /> },
  { path: "/s/:token", element: <Station /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
