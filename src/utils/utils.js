import KJUR from "jsrsasign";

export function generateSignature(sessionName, role, sdkKey, sdkSecret) {
    console.log({ sessionName, role, sdkKey, sdkSecret });

    const iat = Math.round(new Date().getTime() / 1000) - 30; // Current timestamp minus 30 seconds
    const exp = iat + 60 * 60 * 2; // Token expires in 2 hours
    const oHeader = { alg: "HS256", typ: "JWT" };

    const oPayload = {
        app_key: sdkKey,
        tpc: sessionName,
        role_type: role,
        version: 1,
        iat: iat,
        exp: exp,
    };

    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);

    // Generate the JWT
    const sdkJWT = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);

    console.log("Session Name:", sessionName);
    console.log("Role:", role);
    console.log("SDK Key:", sdkKey);
    console.log("SDK Secret:", sdkSecret);
    console.log("Generated token:", sdkJWT);

    return sdkJWT;
}
