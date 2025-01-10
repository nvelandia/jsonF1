import * as dotenv from 'dotenv';
import { ISession, ISessions } from '../utils/interface';
import * as AWS from 'aws-sdk';
import fetch from 'node-fetch';

const stepfunctions = new AWS.StepFunctions();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const currentYear = new Date().getFullYear();

dotenv.config();

export const handler = async (event: any, context: any) => {
  try {
    const allSessions = await getDataOpenF1(process.env.API_SESSIONS!);
    const races = getRaces(allSessions as ISessions);
    console.log('Races:', races);
    createMachines(races);
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

  for (const race of races) {
    const session_key = race.session_key;

    try {
      // Consulta en DynamoDB
      const existingRace = await getRaceFromDynamoDB(session_key);
      // Una consulta a dynamo por cada carrera?

      // Año
      // comparar con js

      if (existingRace) {
        console.log(`Step Function ya existe para la carrera: ${session_key}`);
        results.push({ session_key: session_key, status: 'exists' });
        continue; // Salta la creación
      }

      const params = {
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
        name: `Race-${currentYear}-${session_key}`,
        input: JSON.stringify({
          session_key: session_key,
          match_start: race.date_start,
          waitTime1: calculateWaitTimes(race.date_start, true),
          waitTime2: calculateWaitTimes(race.date_end, false),
        }),
      };

      // Disparar la ejecución de la Step Function
      const data = await stepfunctions.startExecution(params).promise();
      console.log('Ejecución de Step Function iniciada:', data);

      // Registrar en DynamoDB
      await saveRaceToDynamoDB(session_key, data.stateMachineArn, race);

      console.log(`Step Function creada para la carrera: ${session_key}`);
      results.push({ session_key: session_key, status: 'created' });
    } catch (error) {
      console.error(`Error procesando la carrera ${session_key}:`, error);
      results.push({ session_key: session_key, status: 'error', error });
    }
  }

  return { statusCode: 200, body: JSON.stringify(results) };
};

async function getRaceFromDynamoDB(session_key: any) {
  const params = {
    TableName: 'F1Races',
    Key: { session_key: session_key },
  };
  const result = await dynamodb.get(params).promise();
  return result.Item;
}

async function saveRaceToDynamoDB(
  session_key: any,
  stateMachineArn: any,
  race: any
) {
  const params = {
    TableName: 'F1Races',
    Item: {
      session_key: session_key,
      step_function_arn: stateMachineArn,
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
    originalDate.getTime() + (subtract ? -3 : 3) * 60 * 60 * 1000
  );

  return adjustedDate.toISOString();
}
