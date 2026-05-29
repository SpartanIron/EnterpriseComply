import { useEffect } from "react";
import { useLocation } from "wouter";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function SignUp() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(`${BASE_PATH}/sign-in`);
  }, [navigate]);
  return null;
}
