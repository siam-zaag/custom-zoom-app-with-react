import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Meeting from "./pages/Meeting";

function App() {
    return (
        <Router>
            <Routes>
                {/* Home Page (where the form lives) */}
                <Route path="/" element={<Home />} />

                {/* Meeting Page */}
                <Route path="/meeting" element={<Meeting />} />
            </Routes>
        </Router>
    );
}

export default App;
