import React, { Fragment } from "react";
import ZoomVideo from "@zoom/videosdk";
import { useEffect } from "react";
import { generateSignature } from "../utils/utils";
import { useSearchParams } from "react-router-dom";

const sdkKey = import.meta.env.VITE_SDK_KEY;
const sdkSecret = import.meta.env.VITE_SDK_SECRET;
const roomName = "myRoom";

function Zoom() {
    const [searchParams, setSearchParams] = useSearchParams();
    const isHost = searchParams.get("isHost");
    const username = searchParams.get("username");
    console.log("isHost", isHost);
    console.log("username", username);

    useEffect(() => {
        async function initZoom() {
            try {
                const signature = generateSignature(
                    roomName,
                    parseInt(isHost),
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
                await zoomClient.join(roomName, signature, username, "");
                const stream = zoomClient.getMediaStream();
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
    }, [isHost, username]);

    return (
        <Fragment>
            <div className="text-center mt-8">
                <h1>Zoom</h1>
                <p>isHost: {isHost}</p>
                <p>username: {username}</p>
            </div>

            <div className="h-[500px] w-[80%] bg-gray-200 mx-auto mt-8 flex">
                <div className="w-[50%] h-full bg-blue-500">
                    <video
                        id="self-view"
                        className="h-full object-cover"
                    ></video>
                </div>
                <div className="w-[50%] h-full bg-blue-800">
                    <canvas
                        id="participants-c"
                        className="h-full object-cover "
                    ></canvas>
                </div>
            </div>
        </Fragment>
    );
}

export default Zoom;
