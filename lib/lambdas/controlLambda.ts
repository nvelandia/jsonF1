const AWS = require('aws-sdk');
const cloudwatchevents = new AWS.CloudWatchEvents();
import * as dotenv from 'dotenv';
dotenv.config();

export const handler = async (event) => {
  const ruleName = process.env.RULE_NAME;
  const action = event.action; // Espera 'enable' o 'disable'

  if (!ruleName || !action) {
    console.log('Faltan parámetros: RULE_NAME o action');
  }

  console.log('event test', event);

  try {
    if (action === 'enable') {
      await cloudwatchevents.enableRule({ Name: ruleName }).promise();
      console.log(`Regla ${ruleName} habilitada.`);
    } else if (action === 'disable') {
      await cloudwatchevents.disableRule({ Name: ruleName }).promise();
      console.log(`Regla ${ruleName} deshabilitada.`);
    } else {
      console.log('Acción inválida: use "enable" o "disable".');
    }
    return event;
  } catch (error) {
    console.error('Error gestionando la regla:', error);
  }
};
