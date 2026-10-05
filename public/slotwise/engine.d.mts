export type SlotEvent = { day: number; start: number; end: number; slot: string; type: string };
export function events(option: {theory: string; lab: string}, chosenLab?: string): SlotEvent[];
export function overlap(a: {day: number; start: number; end: number}, b: {day: number; start: number; end: number}): boolean;
