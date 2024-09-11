import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from 'react';
import { useCanvas } from './CanvasProvider.jsx';
import { CanvasGestureInfo } from '../logic/Canvas.js';
import { useSnapshot } from 'valtio';
import { closestLivePoint } from '../logic/math.js';
import { LiveVector2 } from '../types.js';
import { atom } from 'signia';

export function useCenter(objectId: string) {
	const canvas = useCanvas();
	return canvas.bounds.getEntry(objectId)?.center;
}

export function useOrigin(objectId: string) {
	const canvas = useCanvas();
	return canvas.bounds.getOrigin(objectId);
}

export function useSize(objectId: string) {
	const canvas = useCanvas();
	return canvas.bounds.getSize(objectId);
}

export function useBoundsObjectIds() {
	const canvas = useCanvas();
	const [ids, setIds] = useState<string[]>(() => canvas.bounds.ids);
	useEffect(() => {
		return canvas.bounds.subscribe('observedChange', () => {
			setIds(canvas.bounds.ids);
		});
	}, [canvas.bounds]);

	return ids;
}

export function useCanvasGestures(handlers: {
	onDragStart?: (info: CanvasGestureInfo) => void;
	onDrag?: (info: CanvasGestureInfo) => void;
	onDragEnd?: (info: CanvasGestureInfo) => void;
	onTap?: (info: CanvasGestureInfo) => void;
}) {
	const canvas = useCanvas();
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const unsubs = [
			canvas.subscribe('canvasDragStart', (info) => {
				handlersRef.current.onDragStart?.(info);
			}),
			canvas.subscribe('canvasDrag', (info) => {
				handlersRef.current.onDrag?.(info);
			}),
			canvas.subscribe('canvasDragEnd', (info) => {
				handlersRef.current.onDragEnd?.(info);
			}),
			canvas.subscribe('canvasTap', (info) => {
				handlersRef.current.onTap?.(info);
			}),
		];

		return () => {
			unsubs.forEach((fn) => fn());
		};
	}, [canvas]);
}

export function useObjectGestures(
	handlers: {
		onDragStart?: (info: CanvasGestureInfo) => void;
		onDrag?: (info: CanvasGestureInfo) => void;
		onDragEnd?: (info: CanvasGestureInfo) => void;
	},
	objectId: string,
) {
	const canvas = useCanvas();
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const unsubs = [
			canvas.subscribe('objectDragStart', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (selected || info.targetId === objectId) {
					handlersRef.current.onDragStart?.(info);
				}
			}),
			canvas.subscribe('objectDrag', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (selected || info.targetId === objectId) {
					handlersRef.current.onDrag?.(info);
				}
			}),
			canvas.subscribe('objectDragEnd', (info) => {
				const selected = canvas.selections.selectedIds.has(objectId);
				if (selected || info.targetId === objectId) {
					handlersRef.current.onDragEnd?.(info);
				}
			}),
		];

		return () => {
			unsubs.forEach((fn) => fn());
		};
	}, [canvas, objectId]);
}

export function useIsSelected(objectId: string) {
	const canvas = useCanvas();
	const [selected, setSelected] = useState(() =>
		canvas.selections.selectedIds.has(objectId),
	);
	const [exclusive, setExclusive] = useState(
		() =>
			canvas.selections.selectedIds.has(objectId) &&
			canvas.selections.selectedIds.size === 1,
	);

	useEffect(() => {
		return canvas.selections.subscribe(`change:${objectId}`, setSelected);
	}, [canvas.selections, objectId]);
	useEffect(() => {
		return canvas.selections.subscribe('change', (selectedIds) => {
			setExclusive(selectedIds.length === 1 && selectedIds[0] === objectId);
		});
	}, [canvas.selections, objectId]);

	return { selected, exclusive };
}

export function useIsPendingSelection(objectId: string) {
	const canvas = useCanvas();
	const [pending, setPending] = useState(() =>
		canvas.selections.pendingIds.has(objectId),
	);
	useEffect(() => {
		return canvas.selections.subscribe(`pendingChange:${objectId}`, setPending);
	}, [canvas.selections, objectId]);

	return pending;
}

export function useSelectedObjectIds() {
	const canvas = useCanvas();
	const [selectedIds, setSelectedIds] = useState(() =>
		Array.from(canvas.selections.selectedIds),
	);

	useEffect(() => {
		return canvas.selections.subscribe('change', setSelectedIds);
	}, [canvas.selections]);

	return selectedIds;
}

export function useCanvasRect() {
	const canvas = useCanvas();

	const [rect, setRect] = useState(() => canvas.boundary);
	useEffect(() => {
		return canvas.subscribe('resize', () => setRect(canvas.boundary));
	}, [canvas]);

	return rect;
}

export function useDragLocked() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).dragLocked;
}

export function useBoxSelectEnabled() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).boxSelect;
}

export function useLiveObjectOrigin(objectId: string | null) {
	const canvas = useCanvas();
	return objectId ? canvas.getLiveOrigin(objectId) : null;
}

export function useLiveObjectCenter(objectId: string) {
	const canvas = useCanvas();
	return canvas.getLiveCenter(objectId);
}

export function useLiveObjectSize(objectId: string) {
	const canvas = useCanvas();
	return canvas.getLiveSize(objectId);
}

export const ZERO_CENTER = atom('zero center', { x: 0, y: 0 });
export const ZERO_BOUNDS = atom('zero bounds', {
	width: 0,
	height: 0,
});
/**
 * Provides the closest boundary position to a given point of an object.
 * Useful for connecting wires.
 */
export function useClosestLiveObjectBoundaryPosition(
	objectId: string,
	closestTo: LiveVector2 | null | undefined,
) {
	const targetCenter = useLiveObjectCenter(objectId) ?? ZERO_CENTER;
	const targetBounds = useLiveObjectSize(objectId) ?? ZERO_BOUNDS;

	return useMemo(() => {
		return closestLivePoint(
			targetCenter,
			targetBounds,
			closestTo || ZERO_CENTER,
			-15,
		);
	}, [targetCenter, targetBounds]);
}
