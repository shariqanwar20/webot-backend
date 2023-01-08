import AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: "2012-08-10" });

exports.handler = async (event: any) => {
  console.log("Event => ", event);

  const user = {
    PK: `USER#${event.request.userAttributes.email}`,
    SK: `METADATA#${event.request.userAttributes.email}`,
    Type: "User",
    UserName: event.userName,
    Email: event.request.userAttributes.email,
    FullName: event.request.userAttributes.name || "Shariq",
    ProfilePicture: event.request.userAttributes.profilePicture || "",
  };

  console.log("User => ", user);

  const userParams = {
    Item: user,
    TableName: process.env.TABLE_NAME!,
    ConditionExpression: "attribute_not_exists(PK)",
  };
  try {
    await dynamodb.put(userParams).promise();
    return event;
  } catch (error) {
    const err: any = error;
    console.log("Error From Creating User => ", err);

    let errorMessage = "Could not create User";

    if (err.code === "ConditionalCheckFailedException") {
      errorMessage = "User with this email ID has already registered.";
    }

    throw new Error(errorMessage);
  }
};
