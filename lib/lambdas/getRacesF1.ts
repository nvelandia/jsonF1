import * as dotenv from 'dotenv';
import { ISession, ISessions } from '../utils/interface';
import * as AWS from 'aws-sdk';
import fetch from 'node-fetch';

const stepfunctions = new AWS.StepFunctions();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const currentYear = new Date().getFullYear();
const f1Table = process.env.TABLE_NAME;

dotenv.config();

export const handler = async (event: any, context: any) => {
  try {
    const allSessions = await getDataOpenF1(process.env.API_SESSIONS!);
    const races = getRaces(allSessions as ISessions);
    console.log('Races:', races);
    const machines = await createMachines(races);
  } catch (error) {
    console.error(error);
  }
};

const getDataOpenF1 = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  return data;
};

const getRaces = (sessions: ISessions) => {
  const races = sessions.filter(
    (session: ISession) =>
      session.session_name.toLowerCase() === 'race' && session.year === 2024
  );

  return races;
};

const createMachines = async (races: any) => {
  const results = [];
  const allRaces = await getRaceFromDynamoDB(2024);

  for (const race of races) {
    const session_key = race.session_key;

    try {
      const existingRace = allRaces.find(
        (item) => item.session_key === session_key
      );

      if (existingRace) {
        console.log(`Step Function ya existe para la carrera: ${session_key}`);
        results.push({ session_key: session_key, status: 'exists' });
      } else {
        console.log('Dont existingRace');

        if (session_key === 9531) {
          const params = {
            stateMachineArn: process.env.STATE_MACHINE_ARN,
            name: `Uru-${currentYear}-${session_key}`,
            input: JSON.stringify({
              session_key: session_key,
              match_start: '2025-01-24T20:00:00+00:00',
              waitTime1: calculateWaitTimes('2025-01-24T20:00:00+00:00', true),
              waitTime2: calculateWaitTimes('2025-01-24T20:00:00+00:00', false),
            }),
          };

          // Disparar la ejecución de la Step Function
          const data = await stepfunctions.startExecution(params).promise();
          console.log('Ejecución de Step Function iniciada:', data);

          // Registrar en DynamoDB
          await saveRaceToDynamoDB(session_key, data.executionArn, race);

          console.log(`Step Function creada para la carrera: ${session_key}`);
          results.push({ session_key: session_key, status: 'created' });
          return;
        }

        // const params = {
        //   stateMachineArn: process.env.STATE_MACHINE_ARN,
        //   name: `Test-${currentYear}-${session_key}`,
        //   input: JSON.stringify({
        //     session_key: session_key,
        //     match_start: race.date_start,
        //     waitTime1: calculateWaitTimes(race.date_start, true),
        //     waitTime2: calculateWaitTimes(race.date_end, false),
        //   }),
        // };

        // // Disparar la ejecución de la Step Function
        // const data = await stepfunctions.startExecution(params).promise();
        // console.log('Ejecución de Step Function iniciada:', data);

        // // Registrar en DynamoDB
        // await saveRaceToDynamoDB(session_key, data.executionArn, race);

        // console.log(`Step Function creada para la carrera: ${session_key}`);
        // results.push({ session_key: session_key, status: 'created' });
      }
    } catch (error) {
      console.error(`Error procesando la carrera ${session_key}:`, error);
      results.push({ session_key: session_key, status: 'error', error });
    }
  }

  return console.log('Result: ', results);
};

async function saveRaceToDynamoDB(
  session_key: any,
  executionArn: any,
  race: any
) {
  const params = {
    TableName: f1Table,
    Item: {
      session_key: session_key,
      step_function_arn: executionArn,
      date: race.date_start, // Fecha de la carrera
      year: race.year,
    },
  };
  await dynamodb.put(params).promise();
}

export function calculateWaitTimes(date: string, subtract: boolean): string {
  const originalDate = new Date(date);

  // Verificar si la fecha es válida
  if (isNaN(originalDate.getTime())) {
    throw new Error('Fecha inválida');
  }

  const adjustedDate = new Date(
    originalDate.getTime() + (subtract ? -1 : 1) * 60 * 60 * 1000
  );

  return adjustedDate.toISOString();
}

async function getRaceFromDynamoDB(currentYear: number) {
  const params = {
    TableName: f1Table,
    FilterExpression: '#year = :yearValue',
    ExpressionAttributeNames: {
      '#year': 'year',
    },
    ExpressionAttributeValues: {
      ':yearValue': currentYear,
    },
  };

  try {
    const data = await dynamodb.scan(params).promise();
    return data.Items;
  } catch (err) {
    console.log('test:', err);
    return err;
  }
}
