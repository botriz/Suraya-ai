// scripts/upload-video.js
// Usage: node scripts/upload-video.js <path> <title> <description> <privacy> <comma_tags>

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

async function main(){
  const args = process.argv.slice(2);
  if(args.length < 4){
    console.error('Usage: node scripts/upload-video.js <path> <title> <description> <privacy> <comma_tags>');
    process.exit(2);
  }
  const [videoPath, title, description, privacy, tags] = args;
  const fullPath = path.resolve(process.cwd(), videoPath);
  if(!fs.existsSync(fullPath)){
    console.error('Video file not found at', fullPath);
    process.exit(3);
  }

  const clientId = process.env.YT_CLIENT_ID;
  const clientSecret = process.env.YT_CLIENT_SECRET;
  const refreshToken = process.env.YT_REFRESH_TOKEN;
  if(!clientId || !clientSecret || !refreshToken){
    console.error('Missing OAuth credentials in env (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN)');
    process.exit(4);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  // obtain access token (the client will do this automatically)
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const res = await youtube.videos.insert({
    part: ['snippet','status'],
    requestBody: {
      snippet: {
        title: title,
        description: description,
        tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : []
      },
      status: { privacyStatus: privacy }
    },
    media: {
      body: fs.createReadStream(fullPath)
    }
  });

  console.log('Upload complete:', res.data.id);
}

main().catch(err => { console.error(err); process.exit(1); });
