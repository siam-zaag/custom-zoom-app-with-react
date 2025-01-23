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

    // Keep track of participants (including yourself)
    const [participants, setParticipants] = useState([]);

    // Canvas references
    const selfVideoRef = useRef(null); // local self-view
    const videoContainerRefs = useRef({}); // { userId: <canvas>, ... }
    const [isCameraBusy, setIsCameraBusy] = useState(false);

    // If someone arrives at /meeting directly, redirect
    useEffect(() => {
        if (!state) {
            navigate("/");
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

                // Listen for participant property changes (e.g., rename)
                zoomClient.on("user-updated", (user) => {
                    setParticipants((prev) =>
                        prev.map((p) => (p.userId === user.userId ? user : p))
                    );
                });

                /**
                 * KEY: Listen for changes in video status (Start/Stop).
                 * This is where we call mediaStream.renderVideo or stopRenderVideo.
                 */
                zoomClient.on(
                    "user-video-status-changed",
                    async ({ action, userId }) => {
                        console.log(
                            `user-video-status-changed -> userId: ${userId}, action: ${action}`
                        );

                        // Local user ID
                        const localUserId =
                            zoomClient.getCurrentUserInfo()?.userId;

                        // Skip if it's the local user, since we handle local video with startVideo()
                        if (userId === localUserId) return;

                        if (action === "Start") {
                            // Remote user turned ON their camera. Render their video.
                            await renderRemoteUserVideo(userId);
                        } else if (action === "Stop") {
                            // Remote user turned OFF their camera. We can stop render or show placeholder.
                            stopRenderRemoteUserVideo(userId);
                        }
                    }
                );
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

    // Helper: Render a remote participant’s video if their camera is ON
    const renderRemoteUserVideo = async (userId) => {
        if (!mediaStream) return;

        // If no canvas for this user, create one
        if (!videoContainerRefs.current[userId]) {
            const canvas = document.createElement("canvas");
            canvas.width = 640;
            canvas.height = 360;
            canvas.style.backgroundColor = "black";
            canvas.style.margin = "5px";
            videoContainerRefs.current[userId] = canvas;
        }

        const canvasElement = videoContainerRefs.current[userId];
        try {
            await mediaStream.renderVideo(
                canvasElement,
                userId,
                640,
                360,
                0,
                0,
                2
            );
            console.log(`Rendered video for userId: ${userId}`);
        } catch (err) {
            console.error(`Error rendering video for user ${userId}`, err);
        }
    };

    // Helper: Stop rendering remote user’s video
    const stopRenderRemoteUserVideo = (userId) => {
        if (!mediaStream) return;
        // Optionally call mediaStream.stopRenderVideo for that user
        // or remove the canvas from the DOM
        try {
            mediaStream.stopRenderVideo(userId);
            console.log(`Stopped video render for userId: ${userId}`);
        } catch (err) {
            console.error(`Error stopping video for user ${userId}`, err);
        }
    };

    /**
     * Join the meeting with generated signature
     */
    const handleJoinMeeting = async () => {
        if (!client || !mediaStream) return;

        setIsJoining(true);
        setError("");

        try {
            // 1. Generate signature (Make sure isHost is 0/1 for the Zoom formula)
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
            navigate("/");
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
        // If we're not joined, or mediaStream is missing, or camera is already busy, do nothing
        if (!joined || !mediaStream || isCameraBusy) return;

        setIsCameraBusy(true); // Mark as busy to block repeated calls
        setError("");

        try {
            if (isVideoOn) {
                await mediaStream.stopVideo();
                setIsVideoOn(false);
            } else {
                await mediaStream.startVideo({
                    videoElement: selfVideoRef.current,
                });
                setIsVideoOn(true);
            }
        } catch (videoErr) {
            console.error("Error toggling video:", videoErr);
            setError("Error toggling video. Check console for details.");
        } finally {
            // Allow toggles again
            setIsCameraBusy(false);
        }
    };

    // Build participant elements for remote users
    const participantVideoElements = participants
        // Filter out local user (we have a separate selfVideoRef)
        .filter((user) => user.userId !== client?.getCurrentUserInfo()?.userId)
        .map((user) => {
            return (
                <div key={user.userId} className="flex flex-col items-center">
                    {/* Attach the participant's <canvas> to the DOM */}
                    <div
                        ref={(element) => {
                            if (
                                element &&
                                videoContainerRefs.current[user.userId]
                            ) {
                                const canvas =
                                    videoContainerRefs.current[user.userId];
                                // If not already attached, append it
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

    // If no state was passed (room name, username, etc.), show nothing
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
                        disabled={isCameraBusy} // <--- disable if busy
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
                        <canvas
                            ref={selfVideoRef}
                            width={640}
                            height={360}
                            className="bg-black rounded"
                        />
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
