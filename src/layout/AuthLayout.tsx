import React from "react";
import "./AuthLayout.css";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="auth-layout">
      <div className="auth-layout__container">{children}</div>
    </div>
  );
};

export default AuthLayout;
