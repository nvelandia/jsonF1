const AWS = require('aws-sdk');
const cloudwatchevents = new AWS.CloudWatchEvents();
import * as dotenv from 'dotenv';
import { iDriver, iPosition, MergedData } from '../utils/interface';
dotenv.config();

export const handler = async (event) => {
  const ruleName = process.env.RULE_NAME; // Nombre de la regla desde variables de entorno
  const action = event.action; // Espera 'enable' o 'disable'

  if (!ruleName || !action) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: 'Faltan parámetros: RULE_NAME o action',
      }),
    };
  }

  try {
    if (action === 'enable') {
      await cloudwatchevents.enableRule({ Name: ruleName }).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Regla ${ruleName} habilitada.` }),
      };
    } else if (action === 'disable') {
      await cloudwatchevents.disableRule({ Name: ruleName }).promise();
      return {
        statusCode: 200,
        body: JSON.stringify({ message: `Regla ${ruleName} deshabilitada.` }),
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Acción inválida: use "enable" o "disable".',
        }),
      };
    }
  } catch (error) {
    console.error('Error gestionando la regla:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error gestionando la regla.',
        error: error.message,
      }),
    };
  }
};
