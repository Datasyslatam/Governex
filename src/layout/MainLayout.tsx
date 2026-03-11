import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar/Sidebar";
import Topbar from "./Topbar/Topbar";
import "./MainLayout.css";

const MainLayout: React.FC = () => {
  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-layout__content">
        <Topbar />
        <main className="main-layout__page">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;