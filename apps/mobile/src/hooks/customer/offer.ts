import { roundTo, type FareBreakdown } from "@raahi/shared";

/** Snap an offer to the step and keep it inside the request's fare bounds. */
export const clampOffer = (value: number, fare: FareBreakdown, step = 10): number => Math.min(fare.maximumFarePkr, Math.max(fare.minimumFarePkr, roundTo(value, step)));
