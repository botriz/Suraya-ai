import { createHmac, createHash, randomUUID } from "node:crypto";

const MIME_EXTENSIONS={
  "image/jpeg":"jpg","image/png":"png","image/webp":"webp",
  "video/mp4":"mp4","video/quicktime":"mov","video/webm":"webm","video/mpeg":"mpeg"
};
const MAX_UPLOAD_BYTES=500*1024*1024;
function sha256(value){return createHash("sha256").update(value).digest("hex")}
function hmac(key,value,encoding){return createHmac("sha256",key).update(value).digest(encoding)}
function encode(value){return encodeURIComponent(value).replace(/[!'()*]/g,char=>"%"+char.charCodeAt(0).toString(16).toUpperCase())}
function canonicalQuery(values){return Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>encode(key)+"="+encode(value)).join("&")}

export function createPresignedMediaUpload({originalName,contentType,sizeBytes,env=process.env,now=new Date()}){
  const extension=MIME_EXTENSIONS[contentType];
  if(!extension)throw new Error("Unsupported media type.");
  if(!Number.isSafeInteger(sizeBytes)||sizeBytes<1||sizeBytes>MAX_UPLOAD_BYTES)throw new Error("Media size must be between 1 byte and 500 MB.");
  const endpoint=new URL(env.SURAYA_S3_ENDPOINT||"");
  const publicBase=new URL(env.SURAYA_S3_PUBLIC_BASE_URL||"");
  if(endpoint.protocol!=="https:"||publicBase.protocol!=="https:"||endpoint.pathname!=="/")throw new Error("S3 endpoint and public media base URL must use HTTPS; the S3 endpoint must not contain a path prefix.");
  const bucket=env.SURAYA_S3_BUCKET||"",region=env.SURAYA_S3_REGION||"auto";
  const accessKey=env.SURAYA_S3_ACCESS_KEY_ID||"",secretKey=env.SURAYA_S3_SECRET_ACCESS_KEY||"";
  if(!bucket||!accessKey||!secretKey)throw new Error("S3-compatible media storage is not configured.");
  const amzDate=now.toISOString().replace(/[:-]|\.\d{3}/g,""),dateStamp=amzDate.slice(0,8);
  const key="social/"+dateStamp+"/"+randomUUID()+"."+extension;
  const endpointPrefix=endpoint.pathname.replace(/\/+$/,"");
  const canonicalUri=(endpointPrefix+"/"+bucket+"/"+key).split("/").map((part,index)=>index===0?"":encode(part)).join("/");
  const host=endpoint.host;
  const credentialScope=dateStamp+"/"+region+"/s3/aws4_request";
  const query={
    "X-Amz-Algorithm":"AWS4-HMAC-SHA256",
    "X-Amz-Credential":accessKey+"/"+credentialScope,
    "X-Amz-Date":amzDate,
    "X-Amz-Expires":"300",
    "X-Amz-SignedHeaders":"content-type;host"
  };
  const signedHeaders="content-type;host";
  const canonicalHeaders="content-type:"+contentType+"\nhost:"+host+"\n";
  const request="PUT\n"+canonicalUri+"\n"+canonicalQuery(query)+"\n"+canonicalHeaders+"\n"+signedHeaders+"\nUNSIGNED-PAYLOAD";
  const stringToSign="AWS4-HMAC-SHA256\n"+amzDate+"\n"+credentialScope+"\n"+sha256(request);
  const kDate=hmac("AWS4"+secretKey,dateStamp),kRegion=hmac(kDate,region),kService=hmac(kRegion,"s3"),kSigning=hmac(kService,"aws4_request");
  const signature=hmac(kSigning,stringToSign,"hex");
  const uploadUrl=new URL(endpoint.origin+canonicalUri);
  uploadUrl.search=canonicalQuery({...query,"X-Amz-Signature":signature});
  const publicUrl=publicBase.toString().replace(/\/+$/,"")+"/"+key.split("/").map(encode).join("/");
  return {key,uploadUrl:uploadUrl.toString(),publicUrl,headers:{"Content-Type":contentType},contentType,sizeBytes,originalName:String(originalName||"media").slice(0,240),expiresInSeconds:300};
}
