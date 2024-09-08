import { MutableRefObject, Ref, useCallback, useRef } from 'react';

export function useMergedRef<T>(...refs: Ref<T>[]) {
	return useCallback((node: T) => {
		refs.forEach((ref) => {
			if (typeof ref === 'function') {
				ref(node);
			} else if (ref) {
				(ref as MutableRefObject<T>).current = node;
			}
		});
	}, refs);
}

export function useStableCallback<T extends (...args: any[]) => any>(
	callback: T,
) {
	const stableRef = useRef(callback);
	return useCallback(
		(...args: Parameters<T>) => stableRef.current(...args),
		[],
	);
}
