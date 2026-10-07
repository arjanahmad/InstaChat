import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import { app, syncDbFromStore, syncDbToStore } from '../../server/app.js';

const serverlessHandler = serverless(app);

export const handler = async (event, context) => {
  if (event && event.blobs) {
    try {
      connectLambda(event);
    } catch (e) {
      console.warn('[Blobs] connectLambda notice:', e.message);
    }
  }

  await syncDbFromStore();
  const response = await serverlessHandler(event, context);
  await syncDbToStore();
  return response;
};

