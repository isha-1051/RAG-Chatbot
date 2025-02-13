import { google } from "googleapis";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];
const CREDENTIALS_PATH = "/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/client_secret_428465629032-dr1cshqja5mfmltsio2epqi97a0k70bm.apps.googleusercontent.com.json"; // Path to your credentials file

export async function authorize() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  // Load tokens if already generated
  const TOKEN_PATH = "/home/tops/Desktop/Ankur/RAG/RAG-Chatbot/token.json";
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } else {
    throw new Error(
      "No tokens found. Run an OAuth2 authentication flow to get access tokens."
    );
  }
}
