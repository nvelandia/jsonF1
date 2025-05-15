import * as AWS from 'aws-sdk';
import { iParams, ISession, ISessions } from '../utils/interface';
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb';
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  PutItemCommandInput,
} from '@aws-sdk/client-dynamodb';

const stepfunctions = new AWS.StepFunctions();
const client = new DynamoDBClient({
  region: 'us-east-1',
});
const currentYear = new Date().getFullYear();
const f1Table = process.env.TABLE_NAME;

export const handler = async () => {
  try {
    const latestRaces = await getDataOpenF1(process.env.API_SESSIONS!);
    let latestRace: ISession = latestRaces[0];

    latestRace = {
      session_key: 10035,
      session_name: 'Race',
      date_start: '2025-05-16T13:00:00+00:00',
      date_end: '2025-05-16T15:00:00+00:00',
      gmt_offset: '-04:00:00',
      session_type: 'Race',
      meeting_key: 1259,
      location: 'Miami',
      country_key: 19,
      country_code: 'USA',
      country_name: 'United States',
      circuit_key: 151,
      circuit_short_name: 'Miami',
      year: 2025,
    };

    console.log('latestRace', latestRace);

    if (latestRace) {
      const item = await getItemById(latestRace.session_key);
      if (item) {
        console.log('Finished race');
      } else {
        console.log('New race');
        await createMachines(latestRace);
      }
    } else {
      console.log('No race data found.');
    }
  } catch (error) {
    console.error(error);
  }
};

const getDataOpenF1 = async (url: string): Promise<ISessions> => {
  const response = await fetch(url);
  const data = await response.json();
  return data as ISessions;
};

const createMachines = async (race: ISession) => {
  const { session_key, date_start, date_end } = race;

  try {
    const inputData: iParams = {
      session_key: session_key,
      match_start: date_start,
      waitTime1: calculateWaitTimes(date_start, true),
      waitTime2: calculateWaitTimes(date_end, false),
    };

    const params: AWS.StepFunctions.StartExecutionInput = {
      stateMachineArn: process.env.STATE_MACHINE_ARN!,
      name: `Session-${currentYear}-${session_key}`,
      input: JSON.stringify(inputData),
    };

    const data = await stepfunctions.startExecution(params).promise();
    await saveRaceToDynamoDB(race, data.executionArn);

    console.log(`Step Function creada para la carrera: ${session_key}`);
  } catch (error) {
    console.error(`Error procesando la carrera ${session_key}:`, error);
  }
};

async function saveRaceToDynamoDB(race: ISession, executionArn: string) {
  const item = {
    session_key: race.session_key,
    step_function_arn: executionArn,
    date: race.date_start,
    year: race.year,
  };

  const params: PutItemCommandInput = {
    TableName: f1Table,
    Item: marshall(item),
  };

  try {
    const command = new PutItemCommand(params);
    await client.send(command);
    console.log('Race saved to DynamoDB');
  } catch (error) {
    console.error('Error saving race:', error);
    throw error;
  }
}

function calculateWaitTimes(date: string, subtract: boolean): string {
  const originalDate = new Date(date);

  if (isNaN(originalDate.getTime())) {
    throw new Error('Fecha inválida');
  }

  const adjustedDate = new Date(
    originalDate.getTime() + (subtract ? -1 : 1) * 60 * 60 * 1000
  );

  return adjustedDate.toISOString();
}

async function getItemById(id: number) {
  const params = {
    TableName: f1Table,
    Key: {
      session_key: { N: id.toString() },
    },
  };

  try {
    const command = new GetItemCommand(params);
    const { Item } = await client.send(command);
    return Item ? unmarshall(Item) : null;
  } catch (error) {
    console.error('Error al obtener el ítem:', error);
    return null;
  }
}
