import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ApiSettings from "./pages/ApiSettings";
import DataUpload from "./pages/DataUpload";
import DataCleaning from "./pages/DataCleaning";
import EDA from "./pages/EDA";
import ExperimentLab from "./pages/ExperimentLab";
import NoiseAnalysis from "./pages/NoiseAnalysis";
import BradleyTerryEval from "./pages/BradleyTerryEval";
import Report from "./pages/Report";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="api-settings" element={<ApiSettings />} />
          <Route path="data-upload" element={<DataUpload />} />
          <Route path="data-cleaning" element={<DataCleaning />} />
          <Route path="eda" element={<EDA />} />
          <Route path="experiment" element={<ExperimentLab />} />
          <Route path="noise" element={<NoiseAnalysis />} />
          <Route path="bradley-terry" element={<BradleyTerryEval />} />
          <Route path="report" element={<Report />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;