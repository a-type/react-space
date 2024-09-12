import {
	createContext,
	useContext,
	useState,
	useSyncExternalStore,
} from 'react';
import { Container, ContainerConfig } from '../../logic/Container.js';

export function useCreateContainer(config: ContainerConfig): Container {
	const [value] = useState(() => new Container(config));
	return value;
}

export function useContainerOverObject(container: Container) {
	return useSyncExternalStore(
		(cb) => container.subscribe('overObjectIdChanged', cb),
		() => container.overObjectId,
	);
}

const containerContext = createContext<Container | null>(null);

export const ContainerProvider = containerContext.Provider;
export function useContainer() {
	const value = useContext(containerContext);
	if (!value) throw new Error('No container context');
	return value;
}
