import { createContext, useContext, useEffect, useState } from 'react';
import { Box } from '../../types.js';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { useCanvas } from '../canvas/CanvasProvider.js';

export interface ContainmentEvent<Metadata> {
	objectId: string;
	objectMetadata?: Metadata;
	objectBounds: Box;
	ownBounds: Box;
	gestureInfo: CanvasGestureInfo;
}

export interface ContainerConfig {
	id: string;
	accept: (containmentEvent: ContainmentEvent<any>) => boolean;
	priority?: number;
}

export interface Container {
	accepts: (containmentEvent: ContainmentEvent<any>) => boolean;
	id: string;
	priority: number;
}

export function useCreateContainer(config: ContainerConfig): Container {
	const [value] = useState(() => ({
		accepts: config.accept,
		id: config.id,
		priority: config.priority ?? 0,
	}));
	return value;
}

export function useContainerOverObject(container: Container) {
	const canvas = useCanvas();
	const [overObjectId, setOverObjectId] = useState<string | null>(null);
	useEffect(() => {
		const unsubOver = canvas.subscribe(
			'containerObjectOver',
			(containerId, objectId) => {
				if (containerId === container.id) {
					setOverObjectId(objectId);
				}
			},
		);
		const unsubOut = canvas.subscribe('containerObjectOut', (containerId) => {
			setOverObjectId(null);
		});
		return () => {
			unsubOver();
			unsubOut();
		};
	}, [canvas, container.id]);
	return overObjectId;
}

const containerContext = createContext<Container | null>(null);

export const ContainerProvider = containerContext.Provider;
export function useContainer() {
	const value = useContext(containerContext);
	if (!value) throw new Error('No container context');
	return value;
}
export function useMaybeContainer() {
	return useContext(containerContext);
}
