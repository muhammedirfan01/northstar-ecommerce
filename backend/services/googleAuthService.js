import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
});

// Exchange the popup code and verify the identity directly with Google.
export async function getGoogleProfile(code) {
  const { tokens } = await googleClient.getToken({
    code,
    redirect_uri: new URL(process.env.CLIENT_URL).origin,
  });
  const ticket = await googleClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}
