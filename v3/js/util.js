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
