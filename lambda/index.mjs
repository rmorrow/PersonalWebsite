// index.mjs (Node.js 22.x / ES Modules)

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { MongoClient } from "mongodb";

const ses = new SESClient({ region: "us-east-1" });
const mongoClient = new MongoClient(process.env.MONGODB_URI); // store this in env vars

export const handler = async (event) => {
  let client;
  try {
    console.log("RAW EVENT:", JSON.stringify(event, null, 2));
    console.log("RAW EVENT BODY:", event.body);

    const body = JSON.parse(event.body || '{}');
    const recipientEmail = body.email;

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

    // Send Email
    const emailParams = {
      Source: "from-email-address@whatever.com",
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: { Data: "Hello from Me" },
        Body: {
          Text: {
            Data: `Hey there!

This is a test message sent to ${recipientEmail} from from-email-address@whatever.com using AWS Lambda.`,
          },
        },
      },
    };

    await ses.send(new SendEmailCommand(emailParams));

    // Insert email into MongoDB
    await mongoClient.connect();
    const db = mongoClient.db("newsletter"); // your DB name
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
      body: JSON.stringify({ message: "Subscribed" }),
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
