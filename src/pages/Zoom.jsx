import React, { Fragment, useState, useEffect } from "react";
import ZoomVideo from "@zoom/videosdk";
import { generateSignature } from "../utils/utils";
import { useLocation, useNavigate } from "react-router-dom";

const sdkKey = import.meta.env.VITE_SDK_KEY;
const sdkSecret = import.meta.env.VITE_SDK_SECRET;

function Zoom() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { username, roomName, isHost } = state || {};

    const [client, setClient] = useState(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [currentCamera, setCurrentCamera] = useState("user");
    const [error, setError] = useState("");

    useEffect(() => {
        async function initZoom() {
            try {
                // 1. Generate signature
                const signature = generateSignature(
                    roomName,
                    isHost ? 1 : 0,
                    sdkKey,
                    sdkSecret
                );

                // 2. Prepare DOM elements
                const selfView = document.getElementById("self-view");
                const participantsCanvas =
                    document.getElementById("participants-c");

                // 3. Create a new client & init
                const zoomClient = ZoomVideo.createClient();
                await zoomClient.init("en-US", "Global", {
                    patchJsMedia: true,
                });
                setClient(zoomClient);

                // 4. Join the session
                await zoomClient.join(roomName, signature, username, "");

                // 5. Get media stream
                const stream = zoomClient.getMediaStream();
                setMediaStream(stream);

                // 6. Start your own local video
                //    (Each participant must do this on their own machine if they want to share video.)
                await stream.startVideo({ videoElement: selfView });

                // 7. Render your own local video feed
                try {
                    await stream.renderVideo(
                        selfView,
                        zoomClient.getCurrentUserInfo().userId,
                        540,
                        960,
                        0,
                        0,
                        2
                    );
                } catch (error) {
                    console.error("Error rendering self video:", error);
                }

                // 8. Render video for all current users who are already sending video
                // const allUsers = zoomClient.getAllUser();
                // for (const user of allUsers) {
                //     if (user.bVideoOn) {
                //         // Only call renderVideo if they're actually sending video
                //         try {
                //             await stream.renderVideo(
                //                 participantsCanvas,
                //                 user.userId,
                //                 540,
                //                 960,
                //                 0,
                //                 0,
                //                 2
                //             );
                //         } catch (err) {
                //             console.error(
                //                 `Error rendering video for user ${user.userId}:`,
                //                 err
                //             );
                //         }
                //     }
                // }

                // // 9. Bind user-related events for new/updated participants
                // bindZoomEvents(zoomClient, stream, participantsCanvas);
            } catch (joinErr) {
                console.error("Error joining the Zoom meeting:", joinErr);
            }
        }

        initZoom();

        // If you want to leave automatically on unmount, uncomment below:
        // return () => {
        //   if (client) {
        //     try {
        //       client.leave();
        //       navigate("/");
        //     } catch (leaveError) {
        //       console.error("Error leaving Zoom session:", leaveError);
        //     }
        //   }
        // };
    }, [isHost, navigate, roomName, username]);

    /**
     * Bind user-related events (added, removed, updated).
     */
    const bindZoomEvents = (zoomClient, stream, participantsCanvas) => {
        // user-added: new participant
        zoomClient.on("user-added", async (user) => {
            console.log("user-added", user);
            if (user.bVideoOn) {
                try {
                    await stream.renderVideo(
                        participantsCanvas,
                        user.userId,
                        540,
                        960,
                        0,
                        0,
                        2
                    );
                } catch (error) {
                    console.error("Error rendering new user's video:", error);
                }
            }
        });

        // user-removed: participant left
        zoomClient.on("user-removed", (user) => {
            console.log("user-removed", user);
            // Optionally stop rendering if you're only using one canvas
            try {
                stream.stopRenderVideo(participantsCanvas, user.userId);
            } catch (error) {
                console.error("Error stopping removed user's video:", error);
            }
        });

        // user-updated: participant toggled video, audio, etc.
        zoomClient.on("user-updated", async (user) => {
            console.log("user-updated", user);
            if (user.bVideoOn) {
                // Turn on their video
                try {
                    await stream.renderVideo(
                        participantsCanvas,
                        user.userId,
                        540,
                        960,
                        0,
                        0,
                        2
                    );
                } catch (error) {
                    console.error(
                        `Error rendering updated user's video:`,
                        error
                    );
                }
            } else {
                // Turn off their video
                try {
                    stream.stopRenderVideo(participantsCanvas, user.userId);
                } catch (error) {
                    console.error(
                        `Error stopping video for user ${user.userId}`,
                        error
                    );
                }
            }
        });
    };

    /**
     * Leave meeting
     */
    const handleLeaveMeeting = async () => {
        try {
            if (client) {
                await client.leave();
            }
            navigate("/");
        } catch (err) {
            console.error("Error leaving meeting:", err);
        }
    };

    /**
     * Toggle Audio
     */
    const handleToggleAudio = async () => {
        if (!mediaStream) return;
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
     * Switch Camera (front <-> back, on devices that have both)
     */
    const switchCamera = async () => {
        if (mediaStream) {
            const newCamera = currentCamera === "user" ? "environment" : "user";
            try {
                await mediaStream.switchCamera(newCamera);
                setCurrentCamera(newCamera);
                console.log(`Switched to ${newCamera} camera`);
            } catch (camErr) {
                console.error("Error switching camera:", camErr);
            }
        }
    };

    return (
        <Fragment>
            <div className="h-[500px] w-[80%] mx-auto mt-8">
                <div className="text-center mt-8">
                    <h1 className="text-2xl font-bold mb-2">
                        Welcome, {username}! You are in room: {roomName}
                    </h1>
                    {isHost ? (
                        <p className="text-green-600 mb-4">You are the host.</p>
                    ) : (
                        <p className="text-gray-600 mb-4">
                            You joined as a guest.
                        </p>
                    )}
                </div>

                {/* Controls */}
                <div className="flex justify-center gap-4 py-5">
                    <button
                        className="bg-gray-200 py-2 px-4 rounded"
                        onClick={handleToggleAudio}
                    >
                        {isAudioOn ? "Mute Audio" : "Unmute Audio"}
                    </button>

                    <button
                        className="bg-red-600 text-white py-2 px-4 rounded mb-4 cursor-pointer"
                        onClick={handleLeaveMeeting}
                    >
                        Leave Meeting
                    </button>

                    <button
                        className="py-4 px-6 bg-purple-500 rounded-xl uppercase text-white ml-2"
                        onClick={switchCamera}
                    >
                        Switch Camera
                    </button>
                </div>

                {/* Video Elements */}
                <div className="flex flex-col gap-1.5 lg:flex-row h-[500px]">
                    {/* LOCAL SELF-VIEW */}
                    <div className="w-full lg:w-[50%] h-full bg-blue-500">
                        <video
                            id="self-view"
                            className="h-full object-cover"
                            // Key attributes to ensure playback in many browsers
                            autoPlay
                            playsInline
                            muted
                        ></video>
                    </div>

                    {/* REMOTE PARTICIPANTS */}
                    <div className="w-full lg:w-[50%] h-full bg-blue-800">
                        <canvas
                            id="participants-c"
                            className="h-full object-cover"
                        ></canvas>
                    </div>
                </div>
            </div>

            {/* Error message (if any) */}
            {error && (
                <div className="text-center mt-4 text-red-600">{error}</div>
            )}
        </Fragment>
    );
}

export default Zoom;
