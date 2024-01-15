export function getCanvasPointFromMouseEvent(canvas, e) {
	const rect = canvas.getBoundingClientRect();
	const scaleX = canvas.width / rect.width;
	const scaleY = canvas.height / rect.height;
	return [
		(e.clientX - rect.left) * scaleX,
		(e.clientY - rect.top) * scaleY
	];
}

export function getCanvasPointFromTouchEvent(canvasElement, touchEvent) {
	const rect = canvasElement.getBoundingClientRect();
	const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
	const scaleX = canvasElement.width / rect.width;
	const scaleY = canvasElement.height / rect.height;
	return [
		(touch.clientX - rect.left) * scaleX,
		(touch.clientY - rect.top) * scaleY,
	]
}



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




export function matrixMatrixMultiply(m1, m2, ...rest) {
	if (rest.length > 0) {
		return matrixMatrixMultiply(matrixMatrixMultiply(m1, m2), ...rest);
	} else {
		return [
			m1[0] * m2[0] + m1[2] * m2[1],
			m1[1] * m2[0] + m1[3] * m2[1],
			m1[0] * m2[2] + m1[2] * m2[3],
			m1[1] * m2[2] + m1[3] * m2[3],
			m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
			m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
		];
	}
}

export function invertScaleTranslationTransform(m) {
	return [
		1 / m[0], 0,
		0, 1 / m[3],
		-m[4] / m[0], -m[5] / m[3],
	];
}

export function transformVector(x, z, ...transformations) {
	if (transformations.length === 0) return [x, z];  // Base case — return as-is
	const [t, ...rest] = transformations;
	const transformed = [
		t[0] * x + t[2] * z + t[4],
		t[1] * x + t[3] * z + t[5],
	];
	return transformVector(...transformed, ...rest);
}

export function determinant(m) {
	return m[0] * m[3] - m[1] * m[2];
}

export function scalingFactor(m) {
	return determinant(m) ** 0.5;
}

export function getScaleMatrix(scale, anchorX, anchorZ) {
	return matrixMatrixMultiply(
		[1, 0, 0, 1, anchorX, anchorZ],
		[scale, 0, 0, scale, 0, 0],
		[1, 0, 0, 1, -anchorX, -anchorZ]
	);
}