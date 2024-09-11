import { EventSubscriber } from '@a-type/utils';
import { Box } from '../types.js';
import { CanvasGestureInfo } from './Canvas.js';

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
	onCandidateStateChange?: (overObjectId: string | null) => void;
}

type ContainerEvents = {
	elementChange: (
		element: HTMLElement | null,
		prevElement: HTMLElement | null,
	) => void;
};

export class Container extends EventSubscriber<ContainerEvents> {
	constructor(private config: ContainerConfig) {
		super();
	}

	accepts = (containmentEvent: ContainmentEvent<any>) => {
		return this.config.accept(containmentEvent);
	};

	get id() {
		return this.config.id;
	}

	get priority() {
		return this.config.priority ?? 0;
	}

	setCandidateState(overObjectId: string | null) {
		this.config.onCandidateStateChange?.(overObjectId);
	}
}
