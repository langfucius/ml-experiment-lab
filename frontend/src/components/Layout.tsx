import { NavLink, Outlet } from "react-router-dom";
import "../App.css";

const navItems = [
  { path: "/", label: "首页" },
  { path: "/api-settings", label: "API 设置" },
  { path: "/data-upload", label: "数据上传" },
  { path: "/data-cleaning", label: "数据清洗" },
  { path: "/eda", label: "EDA 可视化" },
  { path: "/experiment", label: "实验中心" },
  { path: "/noise", label: "动态分析" },
  { path: "/bradley-terry", label: "BT 测评" },
  { path: "/report", label: "报告生成" },
];

function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title">ML Experiment Lab</div>
          <div className="brand-subtitle">机器学习实验与鲁棒性评估平台</div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                isActive ? "nav-link nav-link-active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;