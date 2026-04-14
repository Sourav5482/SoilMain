const avg = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;

export const calculateStats = ({ tempList, humidityList, nList, pList, kList }) => {
  if (!tempList.length || !humidityList.length || !nList.length || !pList.length || !kList.length) {
    throw new Error("Cannot compute stats with empty lists");
  }

  const temperature = Number(avg(tempList).toFixed(2));
  const humidity = Number(avg(humidityList).toFixed(2));
  const n = Number(avg(nList).toFixed(2));
  const p = Number(avg(pList).toFixed(2));
  const k = Number(avg(kList).toFixed(2));

  return {
    temperature,
    humidity,
    npk: { n, p, k },
    minValues: {
      tempMin: Math.min(...tempList),
      humidityMin: Math.min(...humidityList),
      nMin: Math.min(...nList),
      pMin: Math.min(...pList),
      kMin: Math.min(...kList)
    },
    maxValues: {
      tempMax: Math.max(...tempList),
      humidityMax: Math.max(...humidityList),
      nMax: Math.max(...nList),
      pMax: Math.max(...pList),
      kMax: Math.max(...kList)
    }
  };
};
