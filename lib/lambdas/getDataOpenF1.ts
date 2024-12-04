import * as dotenv from 'dotenv';
import { iDriver, iPosition, MergedData } from '../utils/interface';
dotenv.config();

export const handler = async (event: any, context: any) => {
  try {
    const allDrivers = await getDataOpenF1(process.env.API_DRIVERS!);
    const allPositions = await getDataOpenF1(process.env.API_POSITION!);

    const top20 = getTop20(allPositions);
    const positions = mergeDriverData(top20, allDrivers);
    console.log('positions', positions);
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
  const positionMap = new Map();

  // Recorrer el array
  data.forEach((entry: iPosition) => {
    const { position, date } = entry;

    // Si la posición no está en el Map o la fecha es más reciente, actualizar el Map
    if (
      !positionMap.has(position) ||
      new Date(positionMap.get(position).date) < new Date(date)
    ) {
      positionMap.set(position, entry);
    }
  });

  const top20 = Array.from(positionMap.values())
    .sort((a, b) => a.position - b.position)
    .slice(0, 20);
  return top20;
};

const mergeDriverData = (
  positions: iPosition[],
  drivers: iDriver[]
): MergedData[] => {
  // Crear un Map para un acceso rápido a los objetos del array de drivers
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
