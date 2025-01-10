import * as dotenv from 'dotenv';
import { ISession, ISessions } from '../utils/interface';
const AWS = require('aws-sdk');
const stepfunctions = new AWS.StepFunctions();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const currentYear = new Date().getFullYear();

dotenv.config();

export const handler = async (event: any, context: any) => {
  try {
    const allSessions = await getDataOpenF1(process.env.API_SESSIONS!);
    const races = getRaces(allSessions);
    createMachines(races);
    console.log(races);
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
      session.session_type.toLowerCase() === 'race' && session.year === 2024
  );

  return races;
};

const createMachines = async (races) => {
  const results = [];

  for (const race of races) {
    const meetingKey = race.meeting_key;

    try {
      // Consulta en DynamoDB
      const existingRace = await getRaceFromDynamoDB(meetingKey);
      // Una consulta a dynamo por cada carrera?

      if (existingRace) {
        console.log(`Step Function ya existe para la carrera: ${meetingKey}`);
        results.push({ meeting_key: meetingKey, status: 'exists' });
        continue; // Salta la creación
      }

      const params = {
        stateMachineArn: process.env.STEP_FUNCTION_ARN,
        name: `Race-${currentYear}-${meetingKey}`,
        input: JSON.stringify({
          meetingKey: meetingKey,
          match_start: race.date_start,
          waitTime1: calculateWaitTimes(race.date_start, true),
          waitTime2: calculateWaitTimes(race.date_end, false),
        }),
      };

      // Disparar la ejecución de la Step Function
      const data = await stepfunctions.startExecution(params).promise();
      console.log('Ejecución de Step Function iniciada:', data);

      // Registrar en DynamoDB
      await saveRaceToDynamoDB(meetingKey, data.stateMachineArn, race);

      console.log(`Step Function creada para la carrera: ${meetingKey}`);
      results.push({ meeting_key: meetingKey, status: 'created' });
    } catch (error) {
      console.error(`Error procesando la carrera ${meetingKey}:`, error);
      results.push({ meeting_key: meetingKey, status: 'error', error });
    }
  }

  return { statusCode: 200, body: JSON.stringify(results) };
};

async function getRaceFromDynamoDB(meetingKey) {
  const params = {
    TableName: 'F1Races',
    Key: { meeting_key: meetingKey },
  };
  const result = await dynamodb.get(params).promise();
  return result.Item;
}

async function saveRaceToDynamoDB(meetingKey, stateMachineArn, race) {
  const params = {
    TableName: 'F1Races',
    Item: {
      meeting_key: meetingKey,
      step_function_arn: stateMachineArn,
      date: race.date_start, // Fecha de la carrera
      location: race.location,
    },
  };
  await dynamodb.put(params).promise();
}

function calculateWaitTimes(date: string, init: boolean) {
  const localDate = new Date(date.replace(' ', 'T') + '-03:00');

  if (init) {
    localDate.setHours(localDate.getHours() - 1);
  } else {
    localDate.setHours(localDate.getHours() + 1);
  }

  return localDate.toISOString();
}
