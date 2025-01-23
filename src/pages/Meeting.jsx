import ZoomVideo from "@zoom/videosdk";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { generateSignature } from "../utils/utils";

// Zoom Video SDK credentials
const sdkKey = import.meta.env.VITE_SDK_KEY;
const sdkSecret = import.meta.env.VITE_SDK_SECRET;

function Meeting() {
    const { state } = useLocation();
    const navigate = useNavigate();

    // Destructure data passed via navigate()
    const { username, roomName, isHost } = state || {};

    const [client, setClient] = useState(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [joined, setJoined] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState("");

    // Audio/Video toggle states
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);

    // For storing a list of participants (including remote ones)
    const [participants, setParticipants] = useState([]);

    // **Canvas** refs for local and remote video
    const selfVideoRef = useRef(null);
    const videoContainerRefs = useRef({}); // { userId: canvasElement, ... }

    // If someone arrives at /meeting directly, redirect
    useEffect(() => {
        if (!state) {
            navigate("/");
            return;
        }
    }, [state, navigate]);

    /**
     * Initialize Zoom Client
     */
    useEffect(() => {
        const initZoomClient = async () => {
            try {
                const zoomClient = ZoomVideo.createClient();
                await zoomClient.init("en-US", "Global", {
                    patchJsMedia: true,
                });
                setClient(zoomClient);

                const stream = zoomClient.getMediaStream();
                setMediaStream(stream);

                // Listen for participants joining
                zoomClient.on("user-added", (user) => {
                    setParticipants((prev) => [...prev, user]);
                });

                // Listen for participants leaving
                zoomClient.on("user-removed", (user) => {
                    setParticipants((prev) =>
                        prev.filter((p) => p.userId !== user.userId)
                    );
                });

                // Listen for participants updating
                zoomClient.on("user-updated", (user) => {
                    setParticipants((prev) =>
                        prev.map((p) => (p.userId === user.userId ? user : p))
                    );
                });
            } catch (initError) {
                console.error("Error initializing Zoom client:", initError);
                setError(
                    "Could not initialize Zoom. Check console for details."
                );
            }
        };

        initZoomClient();

        // Cleanup: Leave session on unmount
        return () => {
            if (client) {
                try {
                    client.leave();
                } catch (leaveError) {
                    console.error("Error leaving Zoom session:", leaveError);
                }
            }
        };
    }, [client]);

    /**
     * Join the meeting with generated signature
     */
    const handleJoinMeeting = async () => {
        if (!client || !mediaStream) return;

        setIsJoining(true);
        setError("");

        try {
            // 1. Generate signature
            const signature = generateSignature(
                roomName,
                isHost ? 1 : 0,
                sdkKey,
                sdkSecret
            );
            console.log("Generated signature:", signature);

            // 2. Join session
            await client.join(roomName, signature, username, "");
            setJoined(true);
        } catch (joinErr) {
            console.error("Error joining the Zoom meeting:", joinErr);
            setError(
                "Error joining the Zoom meeting. Check console for details."
            );
        } finally {
            setIsJoining(false);
        }
    };

    /**
     * Leave the meeting
     */
    const handleLeaveMeeting = async () => {
        try {
            await client.leave();
            setJoined(false);
            setIsAudioOn(false);
            setIsVideoOn(false);
            setParticipants([]);
        } catch (err) {
            console.error("Error leaving meeting:", err);
        }
    };

    /**
     * Toggle Audio
     */
    const handleToggleAudio = async () => {
        if (!joined || !mediaStream) return;

        try {
            if (isAudioOn) {
                await mediaStream.stopAudio();
                setIsAudioOn(false);
            } else {
                await mediaStream.startAudio();
                setIsAudioOn(true);
            }
        } catch (audioErr) {
            console.error("Error toggling audio:", audioErr);
            setError("Error toggling audio. Check console for details.");
        }
    };

    /**
     * Toggle Video (Self)
     */
    const handleToggleVideo = async () => {
        if (!joined || !mediaStream) return;

        try {
            if (isVideoOn) {
                await mediaStream.stopVideo();
                setIsVideoOn(false);
            } else {
                // **Important**: The element must be <canvas> or <video>
                await mediaStream.startVideo({
                    videoElement: selfVideoRef.current,
                });
                setIsVideoOn(true);
            }
        } catch (videoErr) {
            console.error("Error toggling video:", videoErr);
            setError("Error toggling video. Check console for details.");
        }
    };

    /**
     * Render remote participants whenever they change
     */
    useEffect(() => {
        if (!mediaStream || !joined) return;

        participants.forEach((user) => {
            const localUserId = client?.getCurrentUserInfo()?.userId;

            // Skip rendering for local user in remote participants
            if (user.userId === localUserId) return;

            // If we don't already have a canvas for this user, create one
            if (!videoContainerRefs.current[user.userId]) {
                const canvas = document.createElement("canvas");
                canvas.width = 640;
                canvas.height = 360;
                canvas.style.backgroundColor = "black";
                canvas.style.margin = "5px";
                videoContainerRefs.current[user.userId] = canvas;
            }

            // Render remote user in their canvas
            const canvasElement = videoContainerRefs.current[user.userId];
            mediaStream
                .renderVideo(canvasElement, user.userId, 640, 360, 0, 0, 2)
                .catch((err) =>
                    console.error(
                        `Error rendering video for user ${user.userId}`,
                        err
                    )
                );
        });
    }, [participants, mediaStream, joined, client]);

    // Build participant elements for remote users
    const participantVideoElements = participants
        .filter((user) => user.userId !== client?.getCurrentUserInfo()?.userId)
        .map((user) => {
            return (
                <div key={user.userId} className="flex flex-col items-center">
                    {/* Attach the participant's canvas to the DOM */}
                    <div
                        ref={(element) => {
                            if (
                                element &&
                                videoContainerRefs.current[user.userId]
                            ) {
                                const canvas =
                                    videoContainerRefs.current[user.userId];
                                // If not already attached to the DOM, append it
                                if (!element.contains(canvas)) {
                                    element.appendChild(canvas);
                                }
                            }
                        }}
                    />
                    <p className="text-xs text-gray-200 bg-gray-700 p-1">
                        {user.displayName || `User ${user.userId}`}
                    </p>
                </div>
            );
        });

    // If no state was passed (room name, username, etc.), we show nothing
    if (!state) {
        return null;
    }

    return (
        <div className="flex flex-col items-center p-4">
            {/* Meeting Header */}
            <h1 className="text-2xl font-bold mb-2">
                Welcome, {username}! You are in room: {roomName}
            </h1>

            {isHost ? (
                <p className="text-green-600 mb-4">You are the host.</p>
            ) : (
                <p className="text-gray-600 mb-4">You joined as a guest.</p>
            )}

            {/* Joining/Leaving status & error message */}
            {isJoining && (
                <p className="text-blue-500 mb-2">Joining meeting...</p>
            )}
            {error && <p className="text-red-600 mb-2">{error}</p>}

            {/* Join/Leave Buttons */}
            {!joined ? (
                <button
                    className="bg-blue-600 text-white py-2 px-4 rounded mb-4"
                    onClick={handleJoinMeeting}
                    disabled={isJoining}
                >
                    Join Meeting
                </button>
            ) : (
                <button
                    className="bg-red-600 text-white py-2 px-4 rounded mb-4"
                    onClick={handleLeaveMeeting}
                >
                    Leave Meeting
                </button>
            )}

            {/* Audio/Video Toggles */}
            {joined && (
                <div className="flex gap-4 mb-4">
                    <button
                        className="bg-gray-200 py-2 px-4 rounded"
                        onClick={handleToggleAudio}
                    >
                        {isAudioOn ? "Mute Audio" : "Unmute Audio"}
                    </button>

                    <button
                        className="bg-gray-200 py-2 px-4 rounded"
                        onClick={handleToggleVideo}
                    >
                        {isVideoOn ? "Stop Video" : "Start Video"}
                    </button>
                </div>
            )}

            {/* Video Areas */}
            <div className="flex flex-wrap gap-4 justify-center">
                {/* Self View (Local) */}
                {joined && (
                    <div className="flex flex-col items-center">
                        {/* IMPORTANT: <canvas> for self video */}
                        <canvas
                            ref={selfVideoRef}
                            width={640}
                            height={360}
                            className="bg-black rounded"
                        ></canvas>
                        <p className="text-xs text-gray-200 bg-gray-700 p-1 mt-1">
                            {username} (You)
                        </p>
                    </div>
                )}

                {/* Remote Participants */}
                {participantVideoElements}
            </div>
        </div>
    );
}

export default Meeting;
