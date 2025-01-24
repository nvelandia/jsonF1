import * as dotenv from 'dotenv';

// Load environment variables from a .env file
dotenv.config();

// Define the shape of the configuration object
interface AppConfig {
  deploymentEnv: string;
  awsRegion: string;
  apiDrivers: string;
  apiPosition: string;
}

// Function to retrieve and validate environment variables
export function getAppConfig(): AppConfig {
  // Extract environment variables
  const envVars = {
    deploymentEnv: process.env.DEPLOYMENT_ENV!,
    awsRegion: process.env.CDK_DEFAULT_REGION!,
    apiDrivers: process.env.API_DRIVERS!,
    apiPosition: process.env.API_POSITION!,
    apiSessions: process.env.API_SESSIONS!,
    bucketName: process.env.BUCKET_NAME!,
    stateMachineArn: process.env.STATE_MACHINE_ARN!,
  };

  // Validate that all required environment variables are defined
  const missingVars = Object.entries(envVars)
    .filter(([key, value]) => value === undefined || value === '')
    .map(([key]) => key);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing or invalid environment variables: ${missingVars.join(', ')}`
    );
  }

  // Create and return the configuration object with concatenated apiName
  return envVars;
}
