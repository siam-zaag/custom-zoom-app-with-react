// Home.js

import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Home() {
    const [username, setUsername] = useState("");
    const [roomName, setRoomName] = useState("");
    const [isHost, setIsHost] = useState(false);
    const [error, setError] = useState("");

    const navigate = useNavigate();

    const handleFormSubmit = (e) => {
        e.preventDefault();

        // Validate required fields: username, roomName
        if (!username.trim() || !roomName.trim()) {
            setError("Please enter both Name and Room Name.");
            return;
        }

        // Clear error if fields are valid
        setError("");

        // Navigate to Meeting page with the data
        navigate("/meeting", {
            state: {
                username,
                roomName,
                isHost,
            },
        });
    };

    return (
        <div className="flex justify-center items-center h-screen">
            <form className="flex flex-col gap-2" onSubmit={handleFormSubmit}>
                <label htmlFor="username">Name</label>
                <input
                    type="text"
                    name="username"
                    id="username"
                    className="border h-10 rounded-xl text-xl p-4"
                    placeholder="Enter your name"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <label htmlFor="roomName">Room Name</label>
                <input
                    type="text"
                    name="roomName"
                    id="roomName"
                    className="border h-10 rounded-xl text-xl p-4"
                    placeholder="Enter the room name"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                />

                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        name="isHost"
                        id="isHost"
                        checked={isHost}
                        onChange={(e) => setIsHost(e.target.checked)}
                    />
                    <label htmlFor="isHost">Join as a host</label>
                </div>

                {/* Display error message if fields are invalid */}
                {error && <p className="text-red-600">{error}</p>}

                <button
                    className="bg-blue-600 rounded-2xl py-2 px-5 text-white"
                    type="submit"
                >
                    Join Call
                </button>
            </form>
        </div>
    );
}

export default Home;
