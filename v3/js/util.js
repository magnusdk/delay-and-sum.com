import { params } from "/v3/js/params.js";
import { ProbeInfo } from "/v3/js/probe.js";
import { dist } from "/v3/js/simulation/common.js";


// https://github.com/sindresorhus/debounce
// MIT License
// Thanks!
export function debounce(function_, wait = 100, options = {}) {
	if (typeof function_ !== 'function') {
		throw new TypeError(`Expected the first parameter to be a function, got \`${typeof function_}\`.`);
	}

	if (wait < 0) {
		throw new RangeError('`wait` must not be negative.');
	}

	// TODO: Deprecate the boolean parameter at some point.
	const { immediate } = typeof options === 'boolean' ? { immediate: options } : options;

	let storedContext;
	let storedArguments;
	let timeoutId;
	let timestamp;
	let result;

	function later() {
		const last = Date.now() - timestamp;

		if (last < wait && last >= 0) {
			timeoutId = setTimeout(later, wait - last);
		} else {
			timeoutId = undefined;

			if (!immediate) {
				const callContext = storedContext;
				const callArguments = storedArguments;
				storedContext = undefined;
				storedArguments = undefined;
				result = function_.apply(callContext, callArguments);
			}
		}
	}

	const debounced = function (...arguments_) {
		if (storedContext && this !== storedContext) {
			throw new Error('Debounced method called with different contexts.');
		}

		storedContext = this; // eslint-disable-line unicorn/no-this-assignment
		storedArguments = arguments_;
		timestamp = Date.now();

		const callNow = immediate && !timeoutId;

		if (!timeoutId) {
			timeoutId = setTimeout(later, wait);
		}

		if (callNow) {
			const callContext = storedContext;
			const callArguments = storedArguments;
			storedContext = undefined;
			storedArguments = undefined;
			result = function_.apply(callContext, callArguments);
		}

		return result;
	};

	debounced.clear = () => {
		if (!timeoutId) {
			return;
		}

		clearTimeout(timeoutId);
		timeoutId = undefined;
	};

	debounced.flush = () => {
		if (!timeoutId) {
			return;
		}

		const callContext = storedContext;
		const callArguments = storedArguments;
		storedContext = undefined;
		storedArguments = undefined;
		result = function_.apply(callContext, callArguments);

		clearTimeout(timeoutId);
		timeoutId = undefined;
	};

	return debounced;
}


export function getLateralBeamProfilePoints(numPoints) {
	const probeInfo = ProbeInfo.fromParams(params);
	let [dx, dz] = [
		params.virtualSource[0] - probeInfo.center[0],
		params.virtualSource[1] - probeInfo.center[1],
	];
	// divide by length
	const d = dist(dx, dz);
	const [dirX, dirZ] = [dx / d, dz / d];
	[dx, dz] = [
		dirX * params.time * params.soundSpeed,
		dirZ * params.time * params.soundSpeed,
	]
	const [dxT, dzT] = [-dirZ, dirX];
	//const [dxT, dzT] = [-dirX, -dirZ];
	const w = params.lateralBeamProfileSampleWidth;
	const [x0, z0] = [probeInfo.center[0] + dx + dxT * w / 2, probeInfo.center[1] + dz + dzT * w / 2];
	const [x1, z1] = [probeInfo.center[0] + dx - dxT * w / 2, probeInfo.center[1] + dz - dzT * w / 2];
	const xs = new Array(numPoints).fill(0).map((_, i) => x0 + i / (numPoints - 1) * (x1 - x0));
	const zs = new Array(numPoints).fill(0).map((_, i) => z0 + i / (numPoints - 1) * (z1 - z0));
	return [xs, zs];
}

export function getMinTime() {
	return -5e-3 / params.soundSpeed;
}

export function getMaxTime(grid) {
	return grid.pixelsPerMeter / grid.toCanvasSize(1) / params.soundSpeed;
}