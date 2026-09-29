export type ProteinActivity = 'low' | 'regular' | 'strength';
export type ProteinGoal = 'maintain' | 'muscle' | 'reduction';

export interface ProteinInput {
  age: number;
  weight: number;
  activity: ProteinActivity;
  goal: ProteinGoal;
  meals: number;
}

export interface ProteinRange {
  minimumFactor: number;
  maximumFactor: number;
  minimumDaily: number;
  maximumDaily: number;
  minimumMeal: number;
  maximumMeal: number;
}

export function getProteinFactors(
  age: number,
  activity: ProteinActivity,
  goal: ProteinGoal
): [number, number] {
  const isOlderAdult = age >= 65;

  if (activity === 'strength' || goal === 'muscle' || goal === 'reduction') {
    return [1.2, 1.5];
  }

  if (activity === 'regular') {
    return isOlderAdult ? [1.2, 1.5] : [1.0, 1.2];
  }

  return isOlderAdult ? [1.0, 1.2] : [0.83, 1.0];
}

export function calculateProtein(input: ProteinInput): ProteinRange {
  const [minimumFactor, maximumFactor] = getProteinFactors(input.age, input.activity, input.goal);
  const minimumDaily = Math.round(input.weight * minimumFactor);
  const maximumDaily = Math.round(input.weight * maximumFactor);

  return {
    minimumFactor,
    maximumFactor,
    minimumDaily,
    maximumDaily,
    minimumMeal: Math.round(minimumDaily / input.meals),
    maximumMeal: Math.round(maximumDaily / input.meals)
  };
}
