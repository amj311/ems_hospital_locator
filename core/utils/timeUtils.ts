class Time {
	ms!: number;

	constructor(...units: TimeUnitInput) {
		this.ms = aggregateInput(units);
	}

	valueOf(): number {
		return this.ms;
	}

	toString(): string {
		return String(this.ms);
	}

	get fromNow() {
		return new Time(this.ms + Date.now(), 'ms');
	}

	get date() {
		return new Date(this.ms);
	}
}

export function time(...units: TimeUnitInput) {
	return new Time(...units);
}

export function ago(timestamp: number): string {
	const timeSince = new Date().getTime() - timestamp;
	if (timeSince < M_MS) return 'a few seconds ago';
	if (timeSince < M_MS * 5) return 'a few minutes ago';
	if (timeSince <= H_MS) return Math.floor(timeSince / M_MS) + ' minutes ago';
	if (timeSince < 2 * H_MS) return Math.floor(timeSince / H_MS) + '1 hour ago';
	if (timeSince <= D_MS) return Math.floor(timeSince / H_MS) + ' hours ago';
	if (timeSince < D_MS * 2) return '1 day ago';
	if (timeSince <= W_MS) return Math.floor(timeSince / D_MS) + ' days ago';
	return new Intl.DateTimeFormat('en-us', { 'month': 'short', 'day': 'numeric', 'year': 'numeric' }).format(timestamp);
}

const MS_MS = 1;
const S_MS = 1000 * MS_MS;
const M_MS = 60 * S_MS;
const H_MS = 60 * M_MS;
const D_MS = 24 * H_MS;
const W_MS = 7 * D_MS;
const MONTH_MS = 30 * D_MS;
const MONTH_28_MS = 28 * D_MS;
const MONTH_31_MS = 31 * D_MS;

const UNITS = {
	ms: MS_MS,
	millisecond: MS_MS,
	milliseconds: MS_MS,

	s: S_MS,
	second: S_MS,
	seconds: S_MS,

	m: M_MS,
	minute: M_MS,
	minutes: M_MS,

	h: H_MS,
	hour: H_MS,
	hours: H_MS,

	d: D_MS,
	day: D_MS,
	days: D_MS,

	w: W_MS,
	week: W_MS,
	weeks: W_MS,

	month: MONTH_MS,
	months: MONTH_MS,
} as const;

type TimeUnit = keyof typeof UNITS;

/**
 * Array of values and units in that order, representing a total.
 * Must lead with value as number
 */
type TimeUnitInput = Array<(number | TimeUnit)>;

function validateTimeUnitInput(input: TimeUnitInput) {
	const errorMessage = "Invalid time input! Must be a repeating sequence of a value followed by a unit."
	if (Array.isArray(input)) {
		for (let i = 0; i < input.length; i++) {
			if (i % 2 === 0 && typeof input[i] !== 'number') {
				throw new Error(errorMessage);
			}
			if (i % 2 === 1 && !(input[i] in UNITS)) {
				throw new Error(errorMessage);
			}
		}
	}
	else {
		throw new Error(errorMessage);
	}
}

function aggregateInput(input: TimeUnitInput): number {
	validateTimeUnitInput(input);
	let total = 0;
	if (Array.isArray(input)) {
		let nextUnitValue = 0;
		input.forEach((next, i) => {
			if (i % 2 === 0 && typeof next === 'number') {
				nextUnitValue = next;
			}
			if (i % 2 === 1 && (next in UNITS)) {
				total += getUnitValue(next as TimeUnit, nextUnitValue);
			}
		}, 0 as number);
	}
	return total;
}

function getUnitValue(unit: TimeUnit, qty: number) {
	return qty * UNITS[unit];
}