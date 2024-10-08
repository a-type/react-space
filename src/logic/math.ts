import { LiveVector2, Size, Vector2 } from '../types.js';
import { computed, Signal } from 'signia';

/**
 * Constrains a number to be between a min and max value
 * @param value
 * @param min
 * @param max
 */
export function clamp(
	value: number,
	min: number = -Infinity,
	max: number = Infinity,
) {
	// if min and max overlap, return the average (center)
	if (min > max) {
		return (min + max) / 2;
	}
	return Math.max(min, Math.min(max, value));
}

export function addVectors(v1: Vector2, v2: Vector2) {
	return {
		x: v1.x + v2.x,
		y: v1.y + v2.y,
	};
}

export function subtractVectors(v1: Vector2, v2: Vector2) {
	return addVectors(v1, {
		x: -v2.x,
		y: -v2.y,
	});
}

export function multiplyVector(vec: Vector2, mult: number) {
	return {
		x: vec.x * mult,
		y: vec.y * mult,
	};
}

export function normalizeVector(vec: Vector2) {
	const len = vectorLength(vec);
	if (len === 0) {
		return { x: 0, y: 0 };
	}
	return multiplyVector(vec, 1 / len);
}

export function roundVector(vector: Vector2) {
	return {
		x: Math.round(vector.x),
		y: Math.round(vector.y),
	};
}

/** restricts a vector to the bounds of the rectangle defined by min and max */
export function clampVector(v: Vector2, min: Vector2, max: Vector2) {
	return {
		x: clamp(v.x, min.x, max.x),
		y: clamp(v.y, min.y, max.y),
	};
}

export function vectorDistance(v1: Vector2, v2: Vector2) {
	return Math.sqrt(
		Math.pow(Math.abs(v1.x - v2.x), 2) + Math.pow(Math.abs(v1.y - v2.y), 2),
	);
}

export function vectorLength(v: Vector2 | [number, number]) {
	if (Array.isArray(v)) {
		return Math.sqrt(v[0] ** 2 + v[1] ** 2);
	}
	return Math.sqrt(v.x ** 2 + v.y ** 2);
}

/**
 * "Fuzzes" a vector by moving it a bit in a random direction
 * @param vec the original position
 * @param maxDistance maximum distance to fuzz
 */
export function fuzzVector(vec: Vector2, maxDistance: number = 10) {
	const randomAngle = Math.random() * Math.PI * 2;
	const directionNormal = {
		x: Math.cos(randomAngle),
		y: Math.sin(randomAngle),
	};
	return addVectors(
		vec,
		multiplyVector(directionNormal, Math.random() * maxDistance),
	);
}

/**
 * Rounds a value to the closest multiple of an increment
 */
export function snap(value: number, increment: number) {
	return Math.round(value / increment) * increment;
}

export function snapVector(vec: Vector2, increment: number) {
	return {
		x: snap(vec.x, increment),
		y: snap(vec.y, increment),
	};
}

/**
 * Rounds a value to the closest multiple of an increment,
 * defaulting to 1 x increment if the value is smaller than 1
 * increment instead of 0.
 */
export function snapWithoutZero(value: number, increment: number) {
	return Math.max(increment, snap(value, increment));
}

/**
 * Measures if a number is between a min and max, inclusive on both
 * ends. If either min or max is undefined, it passes that check.
 */
export function isInBounds(value: number, min?: number, max?: number) {
	return (!max || value <= max) && (!min || value >= min);
}

/**
 * Compares two numbers for equality, with a given tolerance
 */
export function compareEpsilon(
	value: number,
	target: number,
	epsilon = Number.EPSILON,
) {
	return Math.abs(value - target) <= epsilon;
}

/**
 * Compares two numbers for equality with a percentage-based tolerance. Default 1%.
 */
export function compareWithTolerance(
	value: number,
	target: number,
	tolerance = 0.01,
) {
	const ratio = value / target;
	const delta = Math.abs(ratio - 1);
	return delta < tolerance;
}

export function isVector2(obj: any): obj is Vector2 {
	return obj.x !== undefined && obj.y !== undefined;
}

export function closestLivePoint(
	sourceCenter: Signal<Vector2>,
	sourceBounds: Signal<Size>,
	targetCenter: Signal<Vector2>,
	shortenBy: number = 0,
) {
	return computed('closestLivePoint', () => {
		const dx = targetCenter.value.x - sourceCenter.value.x;
		const dy = targetCenter.value.y - sourceCenter.value.y;
		const length = Math.sqrt(dx * dx + dy * dy);
		if (length === 0) {
			return { x: sourceCenter.value.x, y: sourceCenter.value.y };
		}
		const normalizedX = dx / length;
		const normalizedY = dy / length;
		const longestBound = Math.max(
			sourceBounds.value.width / 2,
			sourceBounds.value.height / 2,
		);
		const projectedX = normalizedX * longestBound;
		const projectedY = normalizedY * longestBound;

		const shouldCapX = Math.abs(projectedX) > sourceBounds.value.width / 2;
		const shouldCapY = Math.abs(projectedY) > sourceBounds.value.height / 2;
		let cappedX =
			shouldCapX ?
				(Math.sign(projectedX) * sourceBounds.value.width) / 2
			:	projectedX;
		let cappedY =
			shouldCapY ?
				(Math.sign(projectedY) * sourceBounds.value.height) / 2
			:	projectedY;

		// steer toward center of the met side of the boundary and adjust
		// for shorten size
		if (shouldCapY) {
			cappedX = cappedX * 0.5;
			cappedY -= shortenBy * Math.sign(projectedY);
		} else if (shouldCapX) {
			cappedY = cappedY * 0.5;
			cappedX -= shortenBy * Math.sign(projectedX);
		}

		return {
			x: sourceCenter.value.x + cappedX,
			y: sourceCenter.value.y + cappedY,
		};
	});
}

export interface Bezier {
	start: Vector2;
	end: Vector2;
	control1: Vector2;
	control2: Vector2;
}

export function getWireBezierForEndPoints(
	// params are like this for convenience with most usage.
	startX: number,
	startY: number,
	endX: number,
	endY: number,
): Bezier {
	if (Math.abs(startY - endY) < 20) {
		return {
			start: { x: startX, y: startY },
			end: { x: endX, y: endY },
			control1: { x: startX + (endX - startX) / 2, y: startY },
			control2: { x: startX + (endX - startX) / 2, y: endY },
		};
	}

	return {
		start: { x: startX, y: startY },
		end: { x: endX, y: endY },
		control1: { x: startX, y: startY + (endY - startY) / 2 },
		control2: { x: endX, y: startY + (endY - startY) / 2 },
	};
}

export function computeSamplesOnBezier(
	curve: Bezier,
	{
		samples = 100,
		startT = 0,
		endT = 1,
	}: {
		samples?: number;
		startT?: number;
		endT?: number;
	},
) {
	const points = [];
	const range = endT - startT;
	for (let i = 0; i <= samples; i++) {
		const t = startT + (i / samples) * range;
		points.push({
			x:
				(1 - t) ** 3 * curve.start.x +
				3 * (1 - t) ** 2 * t * curve.control1.x +
				3 * (1 - t) * t ** 2 * curve.control2.x +
				t ** 3 * curve.end.x,
			y:
				(1 - t) ** 3 * curve.start.y +
				3 * (1 - t) ** 2 * t * curve.control1.y +
				3 * (1 - t) * t ** 2 * curve.control2.y +
				t ** 3 * curve.end.y,

			t,
		});
	}
	return points;
}

export function distanceToBezier(curve: Bezier, point: Vector2) {
	// start with the whole curve
	const samples = computeSamplesOnBezier(curve, { samples: 100 });
	let minDistance = Infinity;
	let closestPoint = { x: 0, y: 0, t: 0 };
	for (const sample of samples) {
		const distance = vectorDistance(sample, point);
		minDistance = Math.min(minDistance, distance);
		if (distance === minDistance) {
			closestPoint = sample;
		}
	}

	// having found the closest point at default resolution,
	// we can now refine the search around that point
	const refinedSamples = computeSamplesOnBezier(curve, {
		samples: 20,
		startT: closestPoint.t - 0.1,
		endT: closestPoint.t + 0.1,
	});
	for (const sample of refinedSamples) {
		const distance = vectorDistance(sample, point);
		minDistance = Math.min(minDistance, distance);
		if (distance === minDistance) {
			closestPoint = sample;
		}
	}

	return {
		distance: minDistance,
		closestPoint,
	};
}

export function snapshotLiveVector(vec: LiveVector2) {
	return {
		x: vec.value.x,
		y: vec.value.y,
	};
}

export function vectorsEqual(a: Vector2, b: Vector2) {
	return a.x === b.x && a.y === b.y;
}

export function sizesEqual(a: Size, b: Size) {
	return a.width === b.width && a.height === b.height;
}
