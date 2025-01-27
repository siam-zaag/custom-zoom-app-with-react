import React, { Fragment, useState, useEffect } from "react";
import ZoomVideo from "@zoom/videosdk";
import { generateSignature } from "../utils/utils";
import { useLocation, useNavigate } from "react-router-dom";

const sdkKey = import.meta.env.VITE_SDK_KEY;
const sdkSecret = import.meta.env.VITE_SDK_SECRET;

function Zoom() {
    const navigate = useNavigate();
    const { state } = useLocation();
    // state might contain: { username, roomName, isHost }
    const { username, roomName, isHost } = state || {};

    const [client, setClient] = useState(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [currentCamera, setCurrentCamera] = useState("user");
    const [error, setError] = useState("");

    useEffect(() => {
        async function initZoom() {
            try {
                // 1. Generate signature with role = 1 if host, 0 if guest
                const signature = generateSignature(
                    roomName,
                    isHost ? 1 : 0,
                    sdkKey,
                    sdkSecret
                );

                // 2. Grab DOM elements
                const selfView = document.getElementById("self-view");
                const participantsCanvas =
                    document.getElementById("participants-c");

                console.log(selfView, participantsCanvas);

                // 3. Create  client & initialize
                const zoomClient = ZoomVideo.createClient();
                await zoomClient.init("en-US", "Global", {
                    patchJsMedia: true,
                });
                setClient(zoomClient);

                zoomClient
                    .join(roomName, signature, username, "")
                    .then((response) => {
                        let stream = zoomClient.getMediaStream();
                        setMediaStream(stream);

                        stream
                            .startVideo({
                                videoElement: selfView,
                            })
                            .then(() => {
                                console.log("Self video started successfully");

                                stream
                                    .renderVideo(
                                        selfView,
                                        zoomClient.getCurrentUserInfo().userId,
                                        540,
                                        540
                                    )
                                    .then(() => {
                                        console.log(
                                            "Self video rendered successfully",
                                            zoomClient.getCurrentUserInfo()
                                                .userId
                                        );
                                    })
                                    .catch((error) => {
                                        console.error(
                                            "Error rendering video:",
                                            error
                                        );
                                    });

                                zoomClient
                                    .getAllUser()
                                    .forEach(async (user) => {
                                        console.log("user[0 ]", user[0]);
                                        console.log("user.userId", user.userId);

                                        stream
                                            .renderVideo(
                                                participantsCanvas,
                                                user.userId,
                                                540,
                                                960,
                                                0,
                                                0,
                                                2
                                            )
                                            .then(() => {
                                                console.log(
                                                    "User video rendered successfully for user",
                                                    user.userId
                                                );
                                            })
                                            .catch((error) => {
                                                console.error(
                                                    "Error rendering get all user video :",
                                                    error
                                                );
                                            });
                                    });
                            })
                            .catch((error) => {
                                console.error("Error starting video:", error);
                            });

                        function BindEvent(stream) {
                            zoomClient.on("user-added", (payload) => {
                                console.log("user-added", payload);
                                stream
                                    .renderVideo(
                                        participantsCanvas,
                                        payload.userId,
                                        540,
                                        540,
                                        0,
                                        0,
                                        2
                                    )
                                    .then(() => {
                                        console.log(
                                            "User video rendered successfully",
                                            payload.userId
                                        );
                                    })
                                    .catch((error) => {
                                        console.error(
                                            "Error rendering user video:",
                                            error
                                        );
                                    });
                            });
                        }
                    })
                    .catch((error) => {
                        console.log("Error while joining the meeting:", error);
                    });
            } catch (joinErr) {
                console.error("Error joining the Zoom meeting:", joinErr);
            }
        }

        initZoom();

        // OPTIONAL: if you want to leave automatically on unmount, uncomment:
        // return () => {
        //   if (client) {
        //     client.leave().catch(err => console.error("Error leaving on unmount:", err));
        //     navigate("/");
        //   }
        // };
    }, [isHost, navigate, roomName, username]);

    /**
     * Bind user-related events.
     */
    const bindZoomEvents = (zoomClient, stream, participantsCanvas) => {
        console.log("----------i am on zoom page for bindZoomEvents");

        // user-added => a new participant has joined
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

        // user-removed => participant left
        zoomClient.on("user-removed", (user) => {
            console.log("user-removed", user);
            try {
                // Stop rendering if using a shared canvas
                stream.stopRenderVideo(participantsCanvas, user.userId);
            } catch (error) {
                console.error("Error stopping removed user's video:", error);
            }
        });

        // user-updated => participant toggled video/audio or changed name
        zoomClient.on("user-updated", async (user) => {
            console.log("user-updated", user);
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
                    console.error(
                        `Error rendering updated user's video:`,
                        error
                    );
                }
            } else {
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
     * Toggle Audio (Mute/Unmute)
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
     * Switch Camera (front <-> back)
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
                            You joined as a guest. (Role: 0)
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
                    {/* Local Self View */}
                    <div className="w-full lg:w-[50%] h-full bg-blue-500">
                        <video
                            id="self-view"
                            className="h-full object-cover"
                            autoPlay
                            playsInline
                            muted
                        ></video>
                    </div>

                    {/* Remote Participants Canvas */}
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
