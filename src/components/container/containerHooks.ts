import { createContext, useContext, useState } from 'react';
import { Atom } from 'signia';
import { useAtom, useValue } from 'signia-react';
import { ObjectContainmentEvent } from '../../logic/Canvas.js';

export interface ContainerConfig {
	id: string;
	accept?: (containmentEvent: ObjectContainmentEvent<any>) => boolean;
	priority?: number;
}

export interface Container {
	accepts?: (containmentEvent: ObjectContainmentEvent<any>) => boolean;
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
