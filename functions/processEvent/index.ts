import AWSAppSyncClient from 'aws-appsync';
import gql from 'graphql-tag';
import 'cross-fetch/polyfill';

// @ts-ignore
const client = new AWSAppSyncClient({
  url: process.env.APPSYNC_API_URL!,
  region: "us-east-1",
  auth : {
    type: 'API_KEY',
    apiKey: process.env.APPSYNC_API_KEY!,
  },
  disableOffline: true
});

exports.handler = async (event: any) => {
  console.log(event);

  const mutation = gql`
  mutation SendEvent($event: EventBridgeMessageInput!) {
    sendEvent(event: $event) {
      version
      id
      detailType
      source
      account
      time
      region
      resources
      detail
    }
  }
`;
  const variables = {
    event: {
      version: event.version,
      id: event.id,
      detailType: event["detail-type"],
      source: event.source,
      account: event.account,
      time: event.time,
      region: event.region,
      resources: event.resources,
      detail: JSON.stringify(event.detail),
    },
  };

  console.log(variables)
  try {
    await client.mutate({ mutation, variables });
  } catch (error) {
    console.log(error);
  }
};
