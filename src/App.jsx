import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Meeting from "./pages/Meeting";
import Zoom from "./pages/Zoom";

function App() {
    return (
        <Router>
            <Routes>
                {/* Home Page (where the form lives) */}
                {/* <Route path="/" element={<Zoom />} /> */}
                <Route path="/" element={<Home />} />

                {/* Meeting Page */}
                <Route path="/meeting" element={<Meeting />} />
                <Route path="/zoom-meeting" element={<Zoom />} />
            </Routes>
        </Router>
    );
}

export default App;
