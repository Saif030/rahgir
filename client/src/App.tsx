import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Protected from "./components/Protected";
import ArPreview from "./pages/ArPreview";
import Discovery from "./pages/Discovery";
import Itineraries from "./pages/Itineraries";
import Login from "./pages/Login";
import MapPage from "./pages/MapPage";
import Organiser from "./pages/Organiser";
import Register from "./pages/Register";
import { useAppDispatch } from "./store/hooks";
import { bootstrapAuth } from "./store/authSlice";

export default function App() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    void dispatch(bootstrapAuth());
  }, [dispatch]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Discovery />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/itineraries"
            element={
              <Protected>
                <Itineraries />
              </Protected>
            }
          />
          <Route
            path="/organiser"
            element={
              <Protected roles={["ORGANISER", "ADMIN"]}>
                <Organiser />
              </Protected>
            }
          />
          <Route path="/ar" element={<ArPreview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
