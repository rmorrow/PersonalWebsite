// index.mjs (Node.js 22.x / ES Modules)

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { MongoClient } from "mongodb";
//import fetch from 'node-fetch'; 

const ses = new SESClient({ region: "us-east-1" });
const mongoClient = new MongoClient(process.env.MONGODB_URI);

const verifyCaptcha = async (captchaToken) => {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `secret=${secret}&response=${captchaToken}`
  });

  const data = await response.json();
  console.log("CAPTCHA Verification Result:", data);
  return data.success && data.score >= 0.5;
};

export const handler = async (event) => {
  let client;

  try {
    console.log("RAW EVENT:", JSON.stringify(event, null, 2));

    const body = JSON.parse(event.body || '{}');
    const recipientEmail = body.email;
    const captchaToken = body.token; 
    console.log("Parsed Email:", recipientEmail);
    console.log("Parsed CAPTCHA Token:", captchaToken);

    if (!recipientEmail || !recipientEmail.includes('@')) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({ message: "Invalid email address" }),
      };
    }

    if (!captchaToken) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({ message: "Missing CAPTCHA token" }),
      };
    }

    const captchaValid = await verifyCaptcha(captchaToken);
    console.log("CAPTCHA Success:", captchaValid);

    if (!captchaValid) {
      return {
        statusCode: 403,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: JSON.stringify({ message: "CAPTCHA verification failed" }),
      };
    }

    // Send Email
    const emailParams = {
      Source: "ross@rossmorrow.com",
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: { Data: "Hello from Ross" },
        Body: {
          Text: {
            Data: `Hey there!

This is a test message sent to ${recipientEmail} from ross@rossmorrow.com using AWS Lambda.`,
          },
        },
      },
    };

    await ses.send(new SendEmailCommand(emailParams));

    // Save to MongoDB
    await mongoClient.connect();
    const db = mongoClient.db("newsletter");
    const collection = db.collection("subscribers");
    await collection.insertOne({
      email: recipientEmail,
      subscribedAt: new Date(),
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ success: true, message: "Subscribed" }),
    };

  } catch (err) {
    console.error("Handler failed:", err);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: JSON.stringify({ message: "Failed to process request" }),
    };
  } finally {
    await mongoClient.close().catch(console.error);
  }
};
