import React, { Fragment, useState } from "react";
import ZoomVideo from "@zoom/videosdk";
import { useEffect } from "react";
import { generateSignature } from "../utils/utils";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

const sdkKey = import.meta.env.VITE_SDK_KEY;
const sdkSecret = import.meta.env.VITE_SDK_SECRET;

function Zoom() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { username, roomName, isHost } = state || {};

    const [client, setClient] = useState(null);
    const [mediaStream, setMediaStream] = useState(null);
    const [joined, setJoined] = useState(false);
    // Audio/Video toggle states
    const [isAudioOn, setIsAudioOn] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(false);

    // camera state
    const [currentCamera, setCurrentCamera] = useState("user");

    const [error, setError] = useState("");

    useEffect(() => {
        async function initZoom() {
            try {
                const signature = generateSignature(
                    roomName,
                    isHost ? 1 : 0,
                    sdkKey,
                    sdkSecret
                );
                let selfView = document.getElementById("self-view");
                let participantsCanvas =
                    document.getElementById("participants-c");

                let zoomClient = ZoomVideo.createClient();
                await zoomClient.init("en-US", "Global", {
                    patchJsMedia: true,
                });
                setClient(zoomClient);
                await zoomClient.join(roomName, signature, username, "");
                const stream = zoomClient.getMediaStream();
                setMediaStream(stream);
                try {
                    await stream.startVideo({
                        videoElement: selfView,
                    });
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
                        console.log(
                            `Rendered video for userId: ${
                                zoomClient.getCurrentUserInfo().userId
                            }`
                        );

                        zoomClient.getAllUser().forEach(async (user) => {
                            await stream.renderVideo(
                                participantsCanvas,
                                user.userId,
                                540,
                                960,
                                0,
                                0,
                                2
                            );
                        });
                        BindEvents(stream);
                    } catch (error) {
                        console.error("Error rendering video for user", error);
                    }
                } catch (err) {
                    console.error(
                        `Error rendering video for user ${
                            zoomClient.getCurrentUserInfo().userId
                        }`,
                        err
                    );
                }
                function BindEvents(stream) {
                    console.log("Binding events", stream);

                    zoomClient.on("user-added", (payload) => {
                        console.log("user-added", payload);
                        stream.renderVideo(
                            participantsCanvas,
                            payload.userId,
                            540,
                            960,
                            0,
                            0,
                            2
                        );
                    });
                    stream.on("user-removed", (payload) => {
                        console.log("user-removed", payload);
                    });
                }
            } catch (joinErr) {
                console.error("Error joining the Zoom meeting:", joinErr);
            }
        }
        initZoom();
        // return () => {
        //     if (client) {
        //         try {
        //             client.leave();
        //             navigate("/");
        //         } catch (leaveError) {
        //             console.error("Error leaving Zoom session:", leaveError);
        //         }
        //     }
        // };
    }, [client, isHost, navigate, roomName, username]);

    // leave meeting
    const handleLeaveMeeting = async () => {
        try {
            await client.leave();
            navigate("/");
        } catch (err) {
            console.error("Error leaving meeting:", err);
        }
    };

    /**
     * Toggle Audio
     */
    const handleToggleAudio = async () => {
        console.log("i am `handleToggleAudio`");

        if (!mediaStream) return;

        try {
            console.log("i am `handleToggleAudio` try block");

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

    // switch camera
    const switchCamera = async () => {
        if (mediaStream) {
            // Switch between front and back cameras
            const newCamera = currentCamera === "user" ? "environment" : "user";
            await mediaStream.switchCamera(newCamera);
            setCurrentCamera(newCamera);
            console.log(`Switched to ${newCamera} camera`);
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
                <div className="flex flex-col gap-1.5 lg:flex-row h-[500px]">
                    <div className="w-full lg:w-[50%] h-full bg-blue-500">
                        <video
                            id="self-view"
                            className="h-full object-cover"
                        ></video>
                    </div>
                    <div className="w-full lg:w-[50%] h-full bg-blue-800">
                        <canvas
                            id="participants-c"
                            className="h-full object-cover "
                        ></canvas>
                    </div>
                </div>
            </div>
        </Fragment>
    );
}

export default Zoom;
