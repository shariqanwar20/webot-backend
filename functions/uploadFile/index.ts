import * as AWS from "aws-sdk";
import * as AdmZip from "adm-zip";

const s3 = new AWS.S3();
exports.handler = async (event: any) => {
  // recieve zip file as input and upload it to s3
  console.log(event);

  const zip = new AdmZip(Buffer.from(event.body, "base64"));
  const fileNames = zip.getEntries().map((entry) => entry.entryName);
  if (
    fileNames.some((name) => name.includes("docker-compose.yml")) &&
    fileNames.some((name) => name.includes("dockerfile"))
  ) {
    // Both files are present, store in S3 bucket here
    const bucketName = "webot-asset-bucket";
    const key = "test.zip";
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: zip,
      ContentType: "application/zip",
    };
    await s3.putObject(params).promise();
  } else {
  }

  // const bucketName = "webot-asset-bucket";
  // const key = "test.zip";
  // const params = {
  //     Bucket: bucketName,
  //     Key: key,
  //     Body: event.body,
  //     ContentType: "application/zip",
  // };
  // try {
  //     await s3.putObject(params).promise();
  // }
  // catch (error) {
  //     console.log(error);
  // }
};
