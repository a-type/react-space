import { createContext, useContext, useEffect, useState } from 'react';
import { Box } from '../../types.js';
import { CanvasGestureInfo } from '../../logic/Canvas.js';
import { useAtom, useValue } from 'signia-react';
import { Atom } from 'signia';

export interface ContainmentEvent<Metadata> {
	objectId: string;
	objectMetadata?: Metadata;
	objectBounds: Box;
	ownBounds: Box;
	gestureInfo: CanvasGestureInfo;
}

export interface ContainerConfig {
	id: string;
	accept?: (containmentEvent: ContainmentEvent<any>) => boolean;
	priority?: number;
}

export interface Container {
	accepts?: (containmentEvent: ContainmentEvent<any>) => boolean;
	id: string;
	priority: number;
	overState: Atom<{ objectId: string | null; accepted: boolean }[]>;
}

export function useCreateContainer(config: ContainerConfig): Container {
	const overState = useAtom('container over state', []);
	const [value] = useState(() => ({
		accepts: config.accept,
		id: config.id,
		priority: config.priority ?? 0,
		overState,
	}));
	return value;
}

export function useContainerObjectsOver(container: Container) {
	return useValue(container.overState);
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
