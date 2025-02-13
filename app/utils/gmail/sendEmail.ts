import { google } from "googleapis";
import { authorize } from "./auth";

export async function sendEmail(
  from: string,
  to: string,
  subject: string,
  body: string
) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });

  function createRawEmail(
    from: string,
    to: string,
    subject: string,
    body: string
  ): string {
    const encodedMessage = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "",
      body,
    ].join("\r\n");

    return Buffer.from(encodedMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  const rawMessage = createRawEmail(from, to, subject, body);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: rawMessage,
    },
  });

  if (res.data) {
    return {
      success: true,
      message: "Email sent successfully",
    };
  } else {
    return {
      success: false,
      message: "Unable to sent an email",
    };
  }
}

// sendEmail().catch(console.error);
