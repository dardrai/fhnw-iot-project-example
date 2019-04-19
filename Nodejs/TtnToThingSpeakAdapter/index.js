// https://tamberg.mit-license.org/

// https://thingspeak.com/channels/new => CHANNEL_IDs, WRITE_API_KEYs
// https://console.thethingsnetwork.org/applications/TTN_APP_ID => TTN_DEVICE_IDs

// Setup: TTN -Webhook HTTP POST-> TtnToThingSpeakAdapter -HTTP POST-> ThingSpeak
// Local: $ npm install -g now-lambda-runner && now-lambda (e.g. via Yaler.net)
// Using https://zeit.co/ serverless hosting: $ now

const http = require("http"),
  https = require("https"),
  qs = require("querystring");

const appId = "TTN_APP_ID";
const writeApiKeys = {
  "TTN_DEVICE_ID_1": "WRITE_API_KEY_1", // CHANNEL_ID_1
  "TTN_DEVICE_ID_2": "WRITE_API_KEY_2", // CHANNEL_ID_2
  "TTN_DEVICE_ID_3": "WRITE_API_KEY_3", // CHANNEL_ID_3
};

module.exports = (ttnReq, ttnRes) => {
  // Handle the (Webhook) Web request from TTN
  let ttnReqData = "";

  ttnReq.on('data', (data) => {
    ttnReqData += data;
  });

  ttnReq.on('end', () => {
    // Convert the data from TTN to the ThingSpeak data format
    let msg = "";
    let x = 0, y = 0;
    try {
      msg = JSON.parse(ttnReqData);
      const bytes = Buffer.from(msg.payload_raw, 'base64');
      x = ((bytes[0] << 8) | bytes[1]) / 100.0;
      y = ((bytes[2] << 8) | bytes[3]) / 100.0;
    } catch (e) {
      // Error: Reply to the original Web request from TTN
      ttnRes.statusCode = 400;
      ttnRes.end("400 Bad Request - " + e.message);
    }

    // Prepare the Web request to ThingSpeak
    const tsReqData = qs.stringify({
      "api_key": writeApiKeys[msg.dev_id],
      "field1": x,
      "field2": y
    });

    const tsReqOptions = {
      hostname: "api.thingspeak.com",
      path: "/update",
      method: "POST",
      port: 443,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(tsReqData)
      }
    };
  
    const tsReq = https.request(tsReqOptions, (tsRes) => {
      let tsResData = "";

      tsRes.on("data", (chunk) => {
        tsResData += chunk;
      });

      tsRes.on("end", () => {
        // Success: Reply to the original Web request from TTN
        ttnRes.statusCode = 200;
        ttnRes.end("200 OK - " + tsResData);
      });
    });

    tsReq.on("error", (err) => {
      // Error: Reply to the original Web request from TTN
      ttnRes.statusCode = 500;
      ttnRes.end("500 Internal Server Error - " + err.message);
    });

    // Execute the Web request to ThingSpeak
    tsReq.write(tsReqData);
    tsReq.end();
  });
}
