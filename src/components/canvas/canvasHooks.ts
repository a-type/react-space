import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { atom } from 'signia';
import { useSnapshot } from 'valtio';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { useCanvas } from './CanvasProvider.js';

export function useObjectEntry(objectId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.objects.subscribe('entryReplaced', (id) => {
				if (id === objectId) cb();
			}),
		() => canvas.objects.get(objectId),
	);
}

export function useContainerEntry(containerId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.containers.subscribe('entryReplaced', (id) => {
				if (id === containerId) cb();
			}),
		() => canvas.containers.get(containerId),
	);
}

export function useObjectElement(objectId: string | null) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.objects.subscribe('elementChanged', (id) => {
				if (id === objectId) cb();
			}),
		() => (objectId ? (canvas.objects.get(objectId)?.element ?? null) : null),
	);
}

export function useContainerElement(containerId: string | null) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.containers.subscribe('elementChanged', (id) => {
				if (id === containerId) cb();
			}),
		() =>
			containerId ?
				(canvas.containers.get(containerId)?.element ?? null)
			:	null,
	);
}

export function useObjectIds() {
	const canvas = useCanvas();
	const [ids, setIds] = useState<string[]>(() => canvas.objects.ids);
	useEffect(() => {
		return canvas.objects.subscribe('observedChange', () => {
			setIds(canvas.objects.ids);
		});
	}, [canvas.objects]);

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

export function useCanvasLimits() {
	const canvas = useCanvas();
	return canvas.limits;
}

export function useDragLocked() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).dragLocked;
}

export function useBoxSelectEnabled() {
	const canvas = useCanvas();
	return useSnapshot(canvas.tools).boxSelect;
}

export const ZERO_CENTER = atom('zero center', { x: 0, y: 0 });
export const ZERO_BOUNDS = atom('zero bounds', {
	width: 0,
	height: 0,
});
