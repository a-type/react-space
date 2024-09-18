import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { atom } from 'signia';
import { useSnapshot } from 'valtio';
import { BoundsRegistryEntry } from '../../logic/BoundsRegistry.js';
import {
	CanvasGestureInfo,
	CanvasGestureInput,
	ContainerData,
	SurfaceData,
} from '../../logic/Canvas.js';
import { useCanvas } from './CanvasProvider.js';
import { gestureState } from '../gestures/useGestureState.js';

export function useSurfaceEntry(surfaceId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (id) => {
				if (id === surfaceId) cb();
			}),
		() =>
			canvas.bounds.get(surfaceId) as BoundsRegistryEntry<
				SurfaceData<any>
			> | null,
	);
}

export function useContainerEntry(containerId: string) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('entryReplaced', (id) => {
				if (id === containerId) cb();
			}),
		() =>
			canvas.bounds.get(containerId) as BoundsRegistryEntry<
				ContainerData<any>
			> | null,
	);
}

export function useSurfaceElement(surfaceId: string | null) {
	const canvas = useCanvas();
	return useSyncExternalStore(
		(cb) =>
			canvas.bounds.subscribe('elementChanged', (id) => {
				if (id === surfaceId) cb();
			}),
		() => (surfaceId ? (canvas.bounds.get(surfaceId)?.element ?? null) : null),
	);
}
// implementation is identical.
export const useContainerElement = useSurfaceElement;

export function useObjectIds() {
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

export function useClaimedGestures(
	handlers: {
		onDragStart?: (info: CanvasGestureInput) => void;
		onDrag?: (info: CanvasGestureInput) => void;
		onDragEnd?: (info: CanvasGestureInput) => void;
		onTap?: (info: CanvasGestureInput) => void;
	},
	surfaceId: string,
) {
	const canvas = useCanvas();
	const handlersRef = useRef(handlers);
	handlersRef.current = handlers;

	useEffect(() => {
		const unsubs = [
			canvas.subscribe('claimedDragStart', (info) => {
				const selected = canvas.selections.selectedIds.has(surfaceId);
				if (
					(selected && gestureState.claimType === 'surface') ||
					info.targetId === surfaceId
				) {
					handlersRef.current.onDragStart?.(info);
				}
			}),
			canvas.subscribe('claimedDrag', (info) => {
				const selected = canvas.selections.selectedIds.has(surfaceId);
				if (
					(selected && gestureState.claimType === 'surface') ||
					info.targetId === surfaceId
				) {
					handlersRef.current.onDrag?.(info);
				}
			}),
			canvas.subscribe('claimedDragEnd', (info) => {
				const selected = canvas.selections.selectedIds.has(surfaceId);
				if (
					(selected && gestureState.claimType === 'surface') ||
					info.targetId === surfaceId
				) {
					handlersRef.current.onDragEnd?.(info);
				}
			}),
			canvas.subscribe('claimedTap', (info) => {
				if (info.targetId === surfaceId) {
					handlersRef.current.onTap?.(info);
				}
			}),
		];

		return () => {
			unsubs.forEach((fn) => fn());
		};
	}, [canvas, surfaceId]);
}

export function useIsSelected(surfaceId: string) {
	const canvas = useCanvas();
	const selected = useSyncExternalStore(
		(cb) => canvas.selections.subscribe(`change:${surfaceId}`, cb),
		() => canvas.selections.selectedIds.has(surfaceId),
	);
	const exclusive = useSyncExternalStore(
		(cb) => canvas.selections.subscribe('change', cb),
		() =>
			canvas.selections.selectedIds.size === 1 &&
			canvas.selections.selectedIds.has(surfaceId),
	);
	const pending = useSyncExternalStore(
		(cb) => canvas.selections.subscribe(`pendingChange:${surfaceId}`, cb),
		() => canvas.selections.pendingIds.has(surfaceId),
	);

	return { selected, exclusive, pending };
}

export function useIsPendingSelection(surfaceId: string) {
	const canvas = useCanvas();
	const [pending, setPending] = useState(() =>
		canvas.selections.pendingIds.has(surfaceId),
	);
	useEffect(() => {
		return canvas.selections.subscribe(
			`pendingChange:${surfaceId}`,
			setPending,
		);
	}, [canvas.selections, surfaceId]);

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
