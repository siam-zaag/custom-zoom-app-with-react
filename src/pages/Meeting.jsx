// Meeting.js

import { useLocation, useNavigate } from "react-router-dom";

function Meeting() {
    const { state } = useLocation();
    const navigate = useNavigate();

    // Destructure data passed via navigate()
    const { username, roomName, isHost } = state || {};

    // If there's no state (e.g., direct URL access), you can optionally redirect back:
    if (!state) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <p className="text-xl text-red-500">No meeting data found.</p>
                <button
                    className="bg-blue-600 text-white py-2 px-4 rounded"
                    onClick={() => navigate("/")}
                >
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">
                Welcome, {username}! You are in room: {roomName}
            </h1>
            {isHost ? (
                <p className="text-green-700">You are the host.</p>
            ) : (
                <p className="text-gray-700">You joined as a guest.</p>
            )}
            {/* Meeting details or video call components go here */}
        </div>
    );
}

export default Meeting;
