import { createBrowserRouter, Navigate } from "react-router";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import OnboardingSlider from "./components/OnboardingSlider";
import RyveSplashScreen from "./components/RyveSplashScreen";
import SmartRedirect from "./components/SmartRedirect";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SmartRedirect,      // ✅ decides where to go
  },
  {
    path: "/splash",
    Component: RyveSplashScreen,
  },
  {
    path: "/Onboarding",
    Component: OnboardingSlider,
  }, 
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
]);