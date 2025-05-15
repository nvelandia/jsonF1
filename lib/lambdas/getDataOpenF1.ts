import { iDriver, iPosition, MergedData } from '../utils/interface';
import * as AWS from 'aws-sdk';
const s3 = new AWS.S3();

export const handler = async () => {
  try {
    const allDrivers = await getDataOpenF1(process.env.API_DRIVERS!);
    const allPositions = await getDataOpenF1(process.env.API_POSITION!);

    const top20 = getTop20(allPositions);
    const positions = mergeDriverData(top20, allDrivers);
    const jsonContent = JSON.stringify(positions);

    const params = {
      Bucket: process.env.BUCKET_NAME + '/f1',
      Key: 'positionsTest.json',
      Body: jsonContent,
      ContentType: 'application/json',
    };

    await s3.putObject(params).promise();
    console.log('Archivo JSON cargado exitosamente');
  } catch (error) {
    console.error(error);
  }
};

const getDataOpenF1 = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  return data;
};

const getTop20 = (data: [iPosition]) => {
  const latestByDriver: Record<number, iPosition> = {};

  for (const pos of data) {
    latestByDriver[pos.driver_number] = pos;
  }

  return Object.values(latestByDriver).sort((a, b) => a.position - b.position);
};

const mergeDriverData = (
  positions: iPosition[],
  drivers: iDriver[]
): MergedData[] => {
  const driverMap = new Map();
  drivers.forEach((driver) => {
    driverMap.set(driver.driver_number, driver);
  });

  return positions.map((position) => {
    const driverData = driverMap.get(position.driver_number);
    return {
      ...position,
      ...(driverData || {}),
    };
  });
};
